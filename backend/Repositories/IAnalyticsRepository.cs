using Backend.Models.Entities;

namespace Backend.Repositories;

public interface IAnalyticsRepository
{
    Task AddAsync(PageView view, CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>Distinct visitors and total readings for one author over one window.</summary>
    Task<(int UniqueVisitors, int Reads, double AvgDwellSeconds)> GetTotalsAsync(
        int authorId,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Per-day visitors and readings, for the days that had any. Gaps are the caller's to
    /// fill: the database cannot report a day nothing happened on.
    /// </summary>
    Task<IReadOnlyList<DailyTrafficRow>> GetDailyAsync(
        int authorId,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ReferrerRow>> GetReferrersAsync(
        int authorId,
        DateTimeOffset from,
        DateTimeOffset to,
        int limit,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TopPostRow>> GetTopPostsAsync(
        int authorId,
        DateTimeOffset from,
        DateTimeOffset to,
        int limit,
        CancellationToken cancellationToken = default);
}

public record DailyTrafficRow(DateOnly Date, int Visitors, int Reads);

public record ReferrerRow(string? Host, int Visitors, int Reads, double AvgDwellSeconds);

public record TopPostRow(int PostId, string Title, string Slug, string? Summary, int Reads);
