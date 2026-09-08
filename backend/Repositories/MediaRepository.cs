using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories;

public class MediaRepository : IMediaRepository
{
    private readonly BlogDbContext _context;

    public MediaRepository(BlogDbContext context)
    {
        _context = context;
    }

    public Task<Media?> GetByIdAsync(int id, bool tracked = false, CancellationToken cancellationToken = default) =>
        BaseQuery(tracked).FirstOrDefaultAsync(m => m.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Media>> GetByPostIdAsync(
        int postId,
        CancellationToken cancellationToken = default) =>
        await _context.Medias
            .AsNoTracking()
            .Where(m => m.PostId == postId)
            .OrderBy(m => m.CreatedAt)
            .ThenBy(m => m.Id)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(Media media, CancellationToken cancellationToken = default) =>
        await _context.Medias.AddAsync(media, cancellationToken);

    public void Remove(Media media) => _context.Medias.Remove(media);

    public void RemoveRange(IEnumerable<Media> medias) => _context.Medias.RemoveRange(medias);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    private IQueryable<Media> BaseQuery(bool tracked)
    {
        // NOTE: the post comes along because every read of a media row has to answer "may
        // this caller see it?", and that is the post's draft flag and author.
        var query = _context.Medias
            .Include(m => m.Post)
            .AsQueryable();

        return tracked ? query : query.AsNoTracking();
    }
}
