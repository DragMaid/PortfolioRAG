using Backend.Common.Exceptions;
using Backend.Common.Options;
using Backend.Common.Security;
using Backend.Models.DTOs.Auth;
using Backend.Models.Entities;
using Backend.Repositories;
using Microsoft.Extensions.Options;

namespace Backend.Services;

public class EmailVerificationService : IEmailVerificationService
{
    private const string InvalidCode =
        "That code is not valid. It may have expired or already been used — ask for a new one.";

    private readonly IEmailVerificationRepository _codes;
    private readonly IAuthorRepository _authors;
    private readonly ITokenService _tokens;
    private readonly IEmailSender _email;
    private readonly ICurrentUser _currentUser;
    private readonly TimeProvider _timeProvider;
    private readonly EmailVerificationOptions _options;
    private readonly ILogger<EmailVerificationService> _logger;

    public EmailVerificationService(
        IEmailVerificationRepository codes,
        IAuthorRepository authors,
        ITokenService tokens,
        IEmailSender email,
        ICurrentUser currentUser,
        TimeProvider timeProvider,
        IOptions<EmailVerificationOptions> options,
        ILogger<EmailVerificationService> logger)
    {
        _codes = codes;
        _authors = authors;
        _tokens = tokens;
        _email = email;
        _currentUser = currentUser;
        _timeProvider = timeProvider;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<EmailVerificationChallengeDto> IssueAsync(
        Author author,
        CancellationToken cancellationToken = default)
    {
        if (author.EmailConfirmedAt is not null)
            throw new ConflictException("This account's email address is already confirmed.");

        var now = _timeProvider.GetUtcNow();
        var cooldown = TimeSpan.FromSeconds(_options.ResendCooldownSeconds);

        var latest = await _codes.GetLatestAsync(author.Id, cancellationToken);

        if (latest is not null && now < latest.CreatedAt + cooldown)
        {
            var wait = (int)Math.Ceiling((latest.CreatedAt + cooldown - now).TotalSeconds);

            throw new TooManyRequestsException(
                $"A code was sent a moment ago. Wait {wait} more second{(wait == 1 ? string.Empty : "s")} " +
                "before asking for another, and check your spam folder in the meantime.");
        }

        // NOTE: the ceiling counts sends, not failures, because what it is protecting is
        // the inbox on the other end — which may well belong to somebody who never asked
        // to be signed up in the first place.
        var sentToday = await _codes.CountSentSinceAsync(author.Id, now.AddDays(-1), cancellationToken);

        if (sentToday >= _options.MaxSendsPerDay)
        {
            throw new TooManyRequestsException(
                "Too many verification codes have been sent to this address today. Try again tomorrow.");
        }

        // Only the newest code may work: two live codes would double the guessing surface
        // and leave somebody typing whichever mail they opened first.
        await _codes.InvalidateAllAsync(author.Id, now, cancellationToken);

        var code = VerificationCode.Create(_options.CodeLength);
        var expiresAt = now.AddMinutes(_options.LifetimeMinutes);

        await _codes.AddAsync(new EmailVerificationCode
        {
            AuthorId = author.Id,
            Email = author.Email,
            CodeHash = VerificationCode.Hash(code),
            CreatedAt = now,
            ExpiresAt = expiresAt
        }, cancellationToken);

        await _codes.SaveChangesAsync(cancellationToken);

        await _email.SendAsync(BuildMessage(author, code), cancellationToken);

        return new EmailVerificationChallengeDto
        {
            Email = author.Email,
            CodeLength = _options.CodeLength,
            ExpiresAt = expiresAt,
            ResendAvailableAt = now + cooldown,
            Delivered = _email.IsConfigured
        };
    }

    public async Task<EmailVerificationChallengeDto> ResendAsync(CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();

        var author = await _authors.GetByIdAsync(authorId, tracked: false, cancellationToken)
            ?? throw new UnauthorizedException("The signed-in account no longer exists.");

        return await IssueAsync(author, cancellationToken);
    }

    public async Task<AuthResultDto> ConfirmAsync(
        ConfirmEmailDto dto,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var now = _timeProvider.GetUtcNow();

        var author = await _authors.GetByIdAsync(authorId, tracked: true, cancellationToken)
            ?? throw new UnauthorizedException("The signed-in account no longer exists.");

        // NOTE: idempotent. A second submit — a double-clicked button, a retried request —
        // lands here, and the caller is already who the code would have proved they are.
        if (author.EmailConfirmedAt is not null)
            return await _tokens.IssueAsync(author, cancellationToken);

        var submitted = dto.Code.Trim();
        var stored = await _codes.GetActiveAsync(authorId, now, tracked: true, cancellationToken);

        if (stored is null)
        {
            // Same work as a real check, so "nothing outstanding" and "wrong digits" cannot
            // be told apart by how long the answer took.
            VerificationCode.BurnVerificationTime();
            throw new ValidationException(InvalidCode);
        }

        // The code proved the address it was sent to. If the account has been moved to a
        // different one since, it proves nothing about where the account lives now.
        if (!string.Equals(stored.Email, author.Email, StringComparison.OrdinalIgnoreCase))
        {
            stored.ConsumedAt = now;
            await _codes.SaveChangesAsync(cancellationToken);
            throw new ValidationException(InvalidCode);
        }

        if (!VerificationCode.LooksLikeCode(submitted, _options.CodeLength) ||
            !VerificationCode.Verify(submitted, stored.CodeHash))
        {
            stored.Attempts++;

            var exhausted = stored.Attempts >= _options.MaxAttempts;
            if (exhausted)
                stored.ConsumedAt = now;

            await _codes.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Rejected verification code attempt {Attempt} of {Max} for author {AuthorId}.",
                stored.Attempts,
                _options.MaxAttempts,
                authorId);

            throw exhausted
                ? new TooManyRequestsException(
                    "Too many incorrect codes. That code has been cancelled — ask for a new one.")
                : new ValidationException(InvalidCode);
        }

        stored.ConsumedAt = now;
        author.EmailConfirmedAt = now;

        await _codes.SaveChangesAsync(cancellationToken);
        await _authors.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Author {AuthorId} confirmed their email address.", authorId);

        // The old access token says this account is unconfirmed and will go on saying so
        // until it expires, so the caller leaves here holding one that does not.
        return await _tokens.IssueAsync(author, cancellationToken);
    }

    private EmailMessage BuildMessage(Author author, string code)
    {
        var minutes = _options.LifetimeMinutes;

        var body =
            $"""
             Hi {author.Name},

             Your verification code is:

                 {code}

             Enter it in the studio to confirm this address. The code is good for {minutes} minutes.

             If you did not create this account, you can ignore this message — the address
             will not be confirmed, and nothing was published in your name.
             """;

        return new EmailMessage(
            author.Email,
            author.Name,
            $"{code} is your verification code",
            body);
    }
}
