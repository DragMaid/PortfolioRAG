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
    private readonly ITokenService _tokens;
    // TODO: this really just hard coded the google handler instead of a generic external provider but good for now
    private readonly IGoogleTokenValidator _google;
    private readonly ICurrentUser _currentUser;
    private readonly TimeProvider _timeProvider;

    public AuthService(
        IAuthorRepository authors,
        ITokenService tokens,
        IGoogleTokenValidator google,
        ICurrentUser currentUser,
        TimeProvider timeProvider)
    {
        _authors = authors;
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

        var author = new Author
        {
            Name = dto.Name.Trim(),
            Email = email,
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
            var created = new Author
            {
                Name = ResolveName(info),
                Email = info.Email,
                AvatarUrl = info.PictureUrl,
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
        byEmail.AvatarUrl ??= info.PictureUrl;
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
