using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories;

public class AnalyticsRepository : IAnalyticsRepository
{
    private readonly BlogDbContext _context;

    public AnalyticsRepository(BlogDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(PageView view, CancellationToken cancellationToken = default) =>
        await _context.PageViews.AddAsync(view, cancellationToken);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    public async Task<(int UniqueVisitors, int Reads, double AvgDwellSeconds)> GetTotalsAsync(
        int authorId,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken = default)
    {
        var window = Window(authorId, from, to);

        var reads = await window.CountAsync(cancellationToken);

        var uniqueVisitors = await window
            .Select(v => v.VisitorHash)
            .Distinct()
            .CountAsync(cancellationToken);

        // NOTE: readings with no reported duration are left out rather than counted as zero.
        var timed = window.Where(v => v.DwellSeconds > 0);
        var avgDwell = await timed.AnyAsync(cancellationToken)
            ? await timed.AverageAsync(v => (double)v.DwellSeconds, cancellationToken)
            : 0d;

        return (uniqueVisitors, reads, avgDwell);
    }

    public async Task<IReadOnlyList<DailyTrafficRow>> GetDailyAsync(
        int authorId,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken = default)
    {
        // NOTE: grouped on a DateOnly rather than on .UtcDateTime.Date.
        // FromDatedtime convert time detailed to date only
        var rows = await Window(authorId, from, to)
            .GroupBy(v => DateOnly.FromDateTime(v.OccurredAt.UtcDateTime))
            .Select(g => new
            {
                Date = g.Key,
                Visitors = g.Select(v => v.VisitorHash).Distinct().Count(),
                Reads = g.Count()
            })
            .OrderBy(g => g.Date)
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new DailyTrafficRow(r.Date, r.Visitors, r.Reads))
            .ToList();
    }

    public async Task<IReadOnlyList<ReferrerRow>> GetReferrersAsync(
        int authorId,
        DateTimeOffset from,
        DateTimeOffset to,
        int limit,
        CancellationToken cancellationToken = default)
    {
        // NOTE: this query also exclude 0 secs access
        var rows = await Window(authorId, from, to)
            .GroupBy(v => v.ReferrerHost)
            .Select(g => new
            {
                Host = g.Key,
                Visitors = g.Select(v => v.VisitorHash).Distinct().Count(),
                Reads = g.Count(),
                TimedReads = g.Count(v => v.DwellSeconds > 0),
                TotalDwell = g.Sum(v => v.DwellSeconds)
            })
            .OrderByDescending(g => g.Reads)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new ReferrerRow(
                r.Host,
                r.Visitors,
                r.Reads,
                r.TimedReads == 0 ? 0d : r.TotalDwell / (double)r.TimedReads))
            .ToList();
    }

    public async Task<IReadOnlyList<TopPostRow>> GetTopPostsAsync(
        int authorId,
        DateTimeOffset from,
        DateTimeOffset to,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var rows = await Window(authorId, from, to)
            .Where(v => v.PostId != null)
            .GroupBy(v => v.PostId!.Value)
            .Select(g => new { PostId = g.Key, Reads = g.Count() })
            .OrderByDescending(g => g.Reads)
            .Take(limit)
            .Join(
                _context.Posts,
                g => g.PostId,
                p => p.Id,
                (g, p) => new { g.PostId, g.Reads, p.Title, p.Slug, p.Summary })
            .ToListAsync(cancellationToken);

        return rows
            .OrderByDescending(r => r.Reads)
            .Select(r => new TopPostRow(r.PostId, r.Title, r.Slug, r.Summary, r.Reads))
            .ToList();
    }

    private IQueryable<PageView> Window(int authorId, DateTimeOffset from, DateTimeOffset to) =>
        // NOTE: only read page view for posts that belong to author
        _context.PageViews
            .AsNoTracking()
            .Where(v => v.AuthorId == authorId && v.OccurredAt >= from && v.OccurredAt < to);
}
