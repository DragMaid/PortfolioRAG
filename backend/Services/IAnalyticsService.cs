using Backend.Models.DTOs.Analytics;

namespace Backend.Services;

public interface IAnalyticsService
{
    /// <summary>
    /// Records one reading. Anonymous and best-effort: a slug that names nothing is still
    /// counted as a page, because telemetry is not allowed to fail the page it reports on.
    /// </summary>
    Task RecordAsync(TrackViewDto dto, CancellationToken cancellationToken = default);

    /// <summary>
    /// Everything the analytics tab draws, over a rolling window ending now, scoped to the
    /// signed-in author's own posts.
    /// </summary>
    Task<AnalyticsSummaryDto> GetSummaryAsync(int windowDays, CancellationToken cancellationToken = default);

    /// <summary>The same window as a CSV, one row per day. What the Export button downloads.</summary>
    Task<string> ExportCsvAsync(int windowDays, CancellationToken cancellationToken = default);
}
