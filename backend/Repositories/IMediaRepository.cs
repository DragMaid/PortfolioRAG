using Backend.Models.Entities;

namespace Backend.Repositories;

public interface IMediaRepository
{
    /// <summary>Reads one media row with its post attached, which is what ownership is decided on.</summary>
    Task<Media?> GetByIdAsync(int id, bool tracked = false, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Media>> GetByPostIdAsync(int postId, CancellationToken cancellationToken = default);

    Task AddAsync(Media media, CancellationToken cancellationToken = default);

    void Remove(Media media);

    void RemoveRange(IEnumerable<Media> medias);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
