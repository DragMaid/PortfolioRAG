using Backend.Models.Entities;

namespace Backend.Repositories;

public interface IRefreshTokenRepository
{
    /// <summary>Looks a token up by its stored hash — the raw value is never persisted.</summary>
    Task<RefreshToken?> GetByHashAsync(
        string tokenHash,
        bool tracked = true,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RefreshToken>> GetActiveByAuthorAsync(
        int authorId,
        DateTimeOffset now,
        CancellationToken cancellationToken = default);

    Task AddAsync(RefreshToken token, CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
