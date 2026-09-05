using Backend.Models.DTOs;

namespace Backend.Services;

public interface IAuthorService
{
    Task<IReadOnlyList<AuthorDto>> GetAllAsync(CancellationToken cancellationToken = default);

    // TODO: implement the author dto later
    Task<AuthorDto> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    Task<AuthorDto> CreateAsync(CreateAuthorDto dto, CancellationToken cancellationToken = default);

    Task<AuthorDto> UpdateAsync(int id, UpdateAuthorDto dto, CancellationToken cancellationToken = default);

    Task DeleteAsync(int id, CancellationToken cancellationToken = default);
}
