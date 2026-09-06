using Backend.Models.DTOs;

namespace Backend.Services;

public interface IAuthorService
{
    Task<IReadOnlyList<AuthorDto>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<AuthorDto> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    // NOTE: accounts are created by POST /api/auth/register, which is the only path that
    // can attach credentials to one.

    /// <summary>Updates the caller's own profile. Any other id is forbidden.</summary>
    Task<AuthorDto> UpdateAsync(int id, UpdateAuthorDto dto, CancellationToken cancellationToken = default);

    /// <summary>Deletes the caller's own account. Any other id is forbidden.</summary>
    Task DeleteAsync(int id, CancellationToken cancellationToken = default);
}
