using Backend.Common;
using Backend.Common.Exceptions;
using Backend.Common.Security;
using Backend.Mapping;
using Backend.Models.DTOs.Auth;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services;

public class AuthService : IAuthService
{
    // NOTE: one message for every credential failure. Saying "no such account" would turn
    // the login endpoint into a way to enumerate which addresses are registered. It has to
    // be decided here rather than left to the frontend for exactly that reason: the client
    // can only phrase a distinction it was told about, and telling it is the leak.
    private const string InvalidCredentials = "The email address or password is incorrect.";

    private const int MaxNameLength = 100;

    private readonly IAuthorRepository _authors;
    private readonly IApiTokenRepository _apiTokens;
    private readonly ITokenService _tokens;
    // TODO: this really just hard coded the google handler instead of a generic external provider but good for now
    private readonly IGoogleTokenValidator _google;
    private readonly ICurrentUser _currentUser;
    private readonly TimeProvider _timeProvider;

    public AuthService(
        IAuthorRepository authors,
        IApiTokenRepository apiTokens,
        ITokenService tokens,
        IGoogleTokenValidator google,
        ICurrentUser currentUser,
        TimeProvider timeProvider)
    {
        _authors = authors;
        _apiTokens = apiTokens;
        _tokens = tokens;
        _google = google;
        _currentUser = currentUser;
        _timeProvider = timeProvider;
    }

    public async Task<AuthResultDto> RegisterAsync(
        RegisterDto dto,
        CancellationToken cancellationToken = default)
    {
        var email = Normalize(dto.Email);

        if (await _authors.EmailExistsAsync(email, null, cancellationToken))
            throw new ConflictException($"An author with the email '{email}' already exists.");

        var name = dto.Name.Trim();

        var author = new Author
        {
            Name = name,
            Email = email,
            Handle = await ResolveHandleAsync(name, email, excludingAuthorId: null, cancellationToken),
            Biography = string.IsNullOrWhiteSpace(dto.Biography) ? null : dto.Biography.Trim(),
            PasswordHash = PasswordHasher.Hash(dto.Password),
            // NOTE: nothing has vouched for this address yet, which is exactly what keeps a
            // later Google sign-in from silently adopting the account. See SignInWithGoogleAsync.
            EmailConfirmedAt = null,
            CreatedAt = _timeProvider.GetUtcNow()
        };

        await _authors.AddAsync(author, cancellationToken);
        await _authors.SaveChangesAsync(cancellationToken);

        return await _tokens.IssueAsync(author, cancellationToken);
    }

    public async Task<AuthResultDto> LoginAsync(LoginDto dto, CancellationToken cancellationToken = default)
    {
        var author = await _authors.GetByEmailAsync(Normalize(dto.Email), tracked: false, cancellationToken);

        // In case the user was registered fully via gmail and has no password
        if (author?.PasswordHash is null)
        {
            // NOTE: hash anyway so a missing account and a wrong password take the same time.
            PasswordHasher.BurnVerificationTime();
            throw new UnauthorizedException(InvalidCredentials);
        }

        if (!PasswordHasher.Verify(dto.Password, author.PasswordHash))
            throw new UnauthorizedException(InvalidCredentials);

        return await _tokens.IssueAsync(author, cancellationToken);
    }

    public async Task<AuthResultDto> SignInWithGoogleAsync(
        GoogleSignInDto dto,
        CancellationToken cancellationToken = default)
    {
        var info = await ValidateGoogleAsync(dto, cancellationToken);
        var now = _timeProvider.GetUtcNow();

        // 1. Already linked: the provider subject is the identity, so the address may drift.
        // NOTE: the function below get the first occurence or the latest link
        var existingLink = await _authors.GetExternalLoginAsync(info.Provider, info.Subject, cancellationToken);

        if (existingLink is not null)
        {
            var linkedAuthor = await _authors.GetByIdAsync(existingLink.AuthorId, tracked: true, cancellationToken)
                ?? throw new UnauthorizedException("The linked account no longer exists.");

            // Only update the email if its different from the oriinal one
            if (!string.Equals(existingLink.Email, info.Email, StringComparison.OrdinalIgnoreCase))
            {
                existingLink.Email = info.Email;
                await _authors.SaveChangesAsync(cancellationToken);
            }

            return await _tokens.IssueAsync(linkedAuthor, cancellationToken);
        }

        var byEmail = await _authors.GetByEmailAsync(info.Email, tracked: true, cancellationToken);

        // 2. First time here: Google has verified the address, so create the account.
        if (byEmail is null)
        {
            var googleName = ResolveName(info);

            var created = new Author
            {
                Name = googleName,
                Email = info.Email,
                Handle = await ResolveHandleAsync(googleName, info.Email, excludingAuthorId: null, cancellationToken),
                // NOTE: no password assigned if signed in externally
                PasswordHash = null,
                EmailConfirmedAt = now,
                CreatedAt = now
            };

            await _authors.AddAsync(created, cancellationToken);
            await _authors.SaveChangesAsync(cancellationToken);

            await AddLinkAsync(created.Id, info, now, cancellationToken);
            await _authors.SaveChangesAsync(cancellationToken);

            return await _tokens.IssueAsync(created, cancellationToken);
        }

        // 3. An account already holds this address. Auto-linking it would hand the account
        // to whoever signs in with Google — including someone who registered the address
        // with a password before its real owner ever showed up. Only adopt accounts that
        // cannot be sitting on a squatted address: ones with no password, or ones whose
        // address a provider has already confirmed.
        if (byEmail.PasswordHash is not null && byEmail.EmailConfirmedAt is null)
        {
            throw new ConflictException(
                $"An account with the email '{info.Email}' already signs in with a password. " +
                "Sign in with it first, then link Google from your account settings.");
        }

        await AddLinkAsync(byEmail.Id, info, now, cancellationToken);
        byEmail.EmailConfirmedAt ??= now;
        await _authors.SaveChangesAsync(cancellationToken);

        return await _tokens.IssueAsync(byEmail, cancellationToken);
    }

    public async Task<AuthProfileDto> LinkGoogleAsync(
        GoogleSignInDto dto,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var info = await ValidateGoogleAsync(dto, cancellationToken);
        var now = _timeProvider.GetUtcNow();

        var author = await _authors.GetByIdAsync(authorId, tracked: true, cancellationToken)
            ?? throw new UnauthorizedException("The signed-in account no longer exists.");

        var existingLink = await _authors.GetExternalLoginAsync(info.Provider, info.Subject, cancellationToken);

        if (existingLink is not null)
        {
            if (existingLink.AuthorId != authorId)
            {
                throw new ConflictException(
                    "That Google account is already linked to a different author.");
            }

            return await BuildProfileAsync(author, cancellationToken);
        }

        await AddLinkAsync(authorId, info, now, cancellationToken);

        // NOTE: linking only confirms the address when Google vouched for the *same* one.
        if (string.Equals(author.Email, info.Email, StringComparison.OrdinalIgnoreCase))
            author.EmailConfirmedAt ??= now;

        await _authors.SaveChangesAsync(cancellationToken);

        return await BuildProfileAsync(author, cancellationToken);
    }

    public Task<AuthResultDto> RefreshAsync(RefreshTokenDto dto, CancellationToken cancellationToken = default) =>
        _tokens.RotateAsync(dto.RefreshToken, cancellationToken);

    public Task LogoutAsync(RefreshTokenDto dto, CancellationToken cancellationToken = default) =>
        _tokens.RevokeAsync(dto.RefreshToken, cancellationToken);

    public async Task<AuthProfileDto> GetProfileAsync(CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();

        var author = await _authors.GetByIdAsync(authorId, tracked: false, cancellationToken)
            ?? throw new UnauthorizedException("The signed-in account no longer exists.");

        return await BuildProfileAsync(author, cancellationToken);
    }

    public async Task<AuthResultDto> SetPasswordAsync(
        SetPasswordDto dto,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();

        var author = await _authors.GetByIdAsync(authorId, tracked: true, cancellationToken)
            ?? throw new UnauthorizedException("The signed-in account no longer exists.");

        // NOTE: an account created through Google has no password to prove, so it may set
        // its first one straight away. Changing an existing one always needs the old one.
        if (author.PasswordHash is not null &&
            !PasswordHasher.Verify(dto.CurrentPassword ?? string.Empty, author.PasswordHash))
        {
            throw new UnauthorizedException("The current password is incorrect.");
        }

        author.PasswordHash = PasswordHasher.Hash(dto.NewPassword);
        await _authors.SaveChangesAsync(cancellationToken);

        // A password change ends every other session, then hands this caller a fresh pair.
        await _tokens.RevokeAllAsync(authorId, cancellationToken);

        return await _tokens.IssueAsync(author, cancellationToken);
    }

    /* ---------------------------------------------------------------------- */
    /* API tokens                                                             */
    /* ---------------------------------------------------------------------- */

    public async Task<IReadOnlyList<ApiTokenDto>> GetApiTokensAsync(
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var now = _timeProvider.GetUtcNow();

        var tokens = await _apiTokens.GetByAuthorAsync(authorId, cancellationToken);

        return tokens.Select(token => token.ToDto(now)).ToList();
    }

    public async Task<ApiTokenSecretDto> CreateApiTokenAsync(
        CreateApiTokenDto dto,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var now = _timeProvider.GetUtcNow();
        var name = dto.Name.Trim();

        // NOTE: unique among the caller's live tokens only. A name is how somebody decides
        // which token to revoke, and two live "ci-deploy"s would make that a coin toss —
        // but a revoked one is history, and refusing to reuse its name would mean the
        // replacement for a leaked token could never be called what it replaced.
        if (await _apiTokens.NameExistsAsync(authorId, name, excludingTokenId: null, cancellationToken))
            throw new ConflictException($"You already have an active API token called '{name}'.");

        var (rawToken, hash, preview) = ApiTokenGenerator.Create();

        var token = new ApiToken
        {
            AuthorId = authorId,
            Name = name,
            TokenHash = hash,
            Prefix = preview,
            Scope = dto.Scope,
            CreatedAt = now,
            ExpiresAt = dto.ExpiresInDays is { } days ? now.AddDays(days) : null
        };

        await _apiTokens.AddAsync(token, cancellationToken);
        await _apiTokens.SaveChangesAsync(cancellationToken);

        return new ApiTokenSecretDto { Token = token.ToDto(now), Secret = rawToken };
    }

    public async Task<ApiTokenSecretDto> RotateApiTokenAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var now = _timeProvider.GetUtcNow();

        var token = await _apiTokens.GetAsync(id, authorId, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("API token", id);

        // NOTE: rotating a revoked token would quietly bring it back, which is the opposite
        // of what revoking it meant. Issue a new one instead.
        if (token.RevokedAt is not null)
        {
            throw new ConflictException(
                $"The API token '{token.Name}' has been revoked, so it cannot be rotated. " +
                "Create a new token instead.");
        }

        var (rawToken, hash, preview) = ApiTokenGenerator.Create();

        token.TokenHash = hash;
        token.Prefix = preview;

        // The replacement is a different secret with the same name, so what the last-used
        // stamp reported is no longer true of it.
        token.LastUsedAt = null;

        await _apiTokens.SaveChangesAsync(cancellationToken);

        return new ApiTokenSecretDto { Token = token.ToDto(now), Secret = rawToken };
    }

    public async Task<ApiTokenDto> RevokeApiTokenAsync(int id, CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var now = _timeProvider.GetUtcNow();

        var token = await _apiTokens.GetAsync(id, authorId, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("API token", id);

        // NOTE: revoking twice is not an error. The caller wanted it dead and it is dead;
        // the first stamp is kept because it is the one that says when it stopped working.
        if (token.RevokedAt is null)
        {
            token.RevokedAt = now;
            await _apiTokens.SaveChangesAsync(cancellationToken);
        }

        return token.ToDto(now);
    }

    public async Task DeleteApiTokenAsync(int id, CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();

        var token = await _apiTokens.GetAsync(id, authorId, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("API token", id);

        // NOTE: only a dead token may be forgotten. Deleting a live row would revoke it as a
        // side effect and leave no trace that it ever existed, which is the one thing the
        // list is for.
        if (token.RevokedAt is null && token.IsActive(_timeProvider.GetUtcNow()))
        {
            throw new ConflictException(
                $"The API token '{token.Name}' is still active. Revoke it before removing it.");
        }

        _apiTokens.Remove(token);
        await _apiTokens.SaveChangesAsync(cancellationToken);
    }

    private async Task<ExternalUserInfo> ValidateGoogleAsync(
        GoogleSignInDto dto,
        CancellationToken cancellationToken)
    {
        var info = await _google.ValidateAsync(dto.IdToken, cancellationToken);

        // NOTE: an unverified address proves nothing about who is signing in, and every
        // account decision below keys off the address.
        if (!info.EmailVerified)
        {
            throw new UnauthorizedException(
                "Google has not verified this email address, so it cannot be used to sign in.");
        }

        return info;
    }

    private Task AddLinkAsync(
        int authorId,
        ExternalUserInfo info,
        DateTimeOffset now,
        CancellationToken cancellationToken) =>
        _authors.AddExternalLoginAsync(new ExternalLogin
        {
            AuthorId = authorId,
            Provider = info.Provider,
            Subject = info.Subject,
            Email = info.Email,
            CreatedAt = now
        }, cancellationToken);

    private async Task<AuthProfileDto> BuildProfileAsync(Author author, CancellationToken cancellationToken)
    {
        var logins = await _authors.GetExternalLoginsAsync(author.Id, cancellationToken);
        return author.ToProfileDto(logins.Select(l => l.Provider).Distinct().ToList());
    }

    /// <summary>A free public handle for a new account, derived from the display name.</summary>
    private async Task<string> ResolveHandleAsync(
        string name,
        string email,
        int? excludingAuthorId,
        CancellationToken cancellationToken)
    {
        // Re-using the slug generator as they are quite similar
        var seed = SlugGenerator.Generate(name);

        if (string.IsNullOrEmpty(seed))
            seed = SlugGenerator.Generate(email.Split('@')[0]);

        if (string.IsNullOrEmpty(seed))
            seed = "author";

        return await SlugGenerator.GenerateUniqueAsync(
            seed,
            candidate => _authors.HandleExistsAsync(candidate, excludingAuthorId, cancellationToken),
            cancellationToken);
    }

    private static string ResolveName(ExternalUserInfo info)
    {
        // Use the input nae or extract it from the email
        var name = string.IsNullOrWhiteSpace(info.Name)
            ? info.Email.Split('@')[0]
            : info.Name.Trim();

        return name.Length > MaxNameLength ? name[..MaxNameLength] : name;
    }

    private static string Normalize(string email) => email.Trim().ToLowerInvariant();
}
