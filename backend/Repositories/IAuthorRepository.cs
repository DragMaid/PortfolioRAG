using Backend.Models.Entities;

namespace Backend.Repositories;

public interface IAuthorRepository
{
    Task<Author?> GetByIdAsync(int id, bool tracked = false, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Author>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<bool> EmailExistsAsync(string email, int? excludingAuthorId = null, CancellationToken cancellationToken = default);

    Task<bool> HasPostsAsync(int authorId, CancellationToken cancellationToken = default);

    Task AddAsync(Author author, CancellationToken cancellationToken = default);

    void Remove(Author author);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
