using Backend.Models.Entities;

namespace Backend.Repositories;

public interface IApiTokenRepository
{
    /// <summary>Every token an author holds, newest first. Revoked ones included.</summary>
    Task<IReadOnlyList<ApiToken>> GetByAuthorAsync(int authorId, CancellationToken cancellationToken = default);

    /// <summary>One token of an author's, or null. Scoped to the author so a guessed id leaks nothing.</summary>
    Task<ApiToken?> GetAsync(
        int id,
        int authorId,
        bool tracked = true,
        CancellationToken cancellationToken = default);

    /// <summary>Looks a token up by its stored hash — the raw value is never persisted.</summary>
    Task<ApiToken?> GetByHashAsync(
        string tokenHash,
        bool tracked = true,
        CancellationToken cancellationToken = default);

    Task<bool> NameExistsAsync(
        int authorId,
        string name,
        int? excludingTokenId = null,
        CancellationToken cancellationToken = default);

    Task AddAsync(ApiToken token, CancellationToken cancellationToken = default);

    void Remove(ApiToken token);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
