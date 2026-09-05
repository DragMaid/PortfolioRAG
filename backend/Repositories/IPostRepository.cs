using Backend.Models.Entities;
using Backend.Models.Requests;

namespace Backend.Repositories;

public interface IPostRepository
{
    Task<Post?> GetByIdAsync(int id, bool tracked = false, CancellationToken cancellationToken = default);

    Task<Post?> GetBySlugAsync(string slug, bool tracked = false, CancellationToken cancellationToken = default);

    // TODO: define the post request the
    Task<(IReadOnlyList<Post> Items, int TotalItems)> QueryAsync(
        PostQueryRequest request,
        bool NotIsDraftOnly,
        CancellationToken cancellationToken = default);

    Task<bool> SlugExistsAsync(string slug, int? excludingPostId = null, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(int id, CancellationToken cancellationToken = default);

    Task AddAsync(Post post, CancellationToken cancellationToken = default);

    Task RemoveAsync(Post post, CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
