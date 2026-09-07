using Backend.Data;
using Backend.Models.Entities;
using Backend.Models.Requests;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories;

public class PostRepository : IPostRepository
{
    private readonly BlogDbContext _context;

    public PostRepository(BlogDbContext context)
    {
        _context = context;
    }

    public Task<Post?> GetByIdAsync(int id, bool tracked = false, CancellationToken cancellationToken = default) =>
        BaseQuery(tracked).FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    public Task<Post?> GetBySlugAsync(string slug, bool tracked = false, CancellationToken cancellationToken = default) =>
        BaseQuery(tracked).FirstOrDefaultAsync(p => p.Slug == slug, cancellationToken);

    public async Task<(IReadOnlyList<Post> Items, int TotalItems)> QueryAsync(
        PostQueryRequest request,
        bool? isDraft,
        CancellationToken cancellationToken = default)
    {
        var query = BaseQuery(tracked: false);

        if (isDraft is not null)
        {
            query = query.Where(p => p.IsDraft == isDraft);
        }

        if (request.AuthorId.HasValue)
        {
            query = query.Where(p => p.AuthorId == request.AuthorId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLowerInvariant();
            query = query.Where(p =>
                    p.Title.ToLower().Contains(term) ||
                    (p.Summary != null && p.Summary.ToLower().Contains(term)) ||
                    p.Body.ToLower().Contains(term));
        }

        var totalItems = await query.CountAsync(cancellationToken);

        query = request.Sort switch
        {
            PostSortOrder.Oldest => query.OrderBy(p => p.PublishedAt ?? p.CreatedAt).ThenBy(p => p.Id),
            PostSortOrder.MostViewed => query.OrderByDescending(p => p.ViewCount).ThenByDescending(p => p.Id),
            PostSortOrder.Title => query.OrderBy(p => p.Title).ThenBy(p => p.Id),
            _ => query.OrderByDescending(p => p.PublishedAt ?? p.CreatedAt).ThenByDescending(p => p.Id)
        };

        var items = await query
            .Skip(request.Skip)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        return (items, totalItems);
    }

    public Task<bool> SlugExistsAsync(
        string slug,
        int? excludingPostId = null,
        CancellationToken cancellationToken = default) =>
        _context.Posts.AnyAsync(
            p => p.Slug == slug && (excludingPostId == null || p.Id != excludingPostId),
            cancellationToken);

    public Task<bool> ExistsAsync(int id, CancellationToken cancellationToken = default) =>
        _context.Posts.AnyAsync(p => p.Id == id, cancellationToken);

    public async Task AddAsync(Post post, CancellationToken cancellationToken = default) =>
        await _context.Posts.AddAsync(post, cancellationToken);

    public async Task RemoveAsync(Post post, CancellationToken cancellationToken = default)
    {
        // TODO: this is gonna have to remove all the damn medias file also
        // TODO: maybe this is kind of a in-memory quirk, when i move to relational db
        // these should be handled automatically via cascaE so no problem, remove later
        var medias = await _context.Medias
            .Where(m => m.PostId == post.Id)
            .ToListAsync(cancellationToken);

        _context.Medias.RemoveRange(medias);
        _context.Posts.Remove(post);
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    private IQueryable<Post> BaseQuery(bool tracked)
    {
        var query = _context.Posts
            .Include(p => p.Author)
            .AsQueryable();

        return tracked ? query : query.AsNoTracking();
    }
}

