using Backend.Models.Entities;

namespace Backend.Repositories;

public interface IEmailVerificationRepository
{
    /// <summary>
    /// The code an account is currently expected to type: the newest one that has not been
    /// spent or expired, or null when there is none outstanding.
    /// </summary>
    Task<EmailVerificationCode?> GetActiveAsync(
        int authorId,
        DateTimeOffset now,
        bool tracked = false,
        CancellationToken cancellationToken = default);

    /// <summary>The newest code issued to this account, spent or not. What the cooldown reads.</summary>
    Task<EmailVerificationCode?> GetLatestAsync(
        int authorId,
        CancellationToken cancellationToken = default);

    /// <summary>How many codes this account has been sent since <paramref name="since"/>.</summary>
    Task<int> CountSentSinceAsync(
        int authorId,
        DateTimeOffset since,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Kills every code still outstanding for an account. Issuing a new one calls this, so
    /// only the code in the latest mail ever works.
    /// </summary>
    Task InvalidateAllAsync(
        int authorId,
        DateTimeOffset now,
        CancellationToken cancellationToken = default);

    Task AddAsync(EmailVerificationCode code, CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
