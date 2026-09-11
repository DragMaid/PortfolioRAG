using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Backend.Common.Security;
using Backend.Models.DTOs.Analytics;
using Backend.Models.Entities;
using Backend.Repositories;
using Microsoft.Extensions.Options;
using Backend.Common.Options;

namespace Backend.Services;

public class AnalyticsService : IAnalyticsService
{
    public const int MinWindowDays = 1;

    public const int MaxWindowDays = 90;

    /// <summary>Max 1 day for a post reading session.</summary>
    public const int MaxRecordSecs = 60 * 60 * 24;

    public const int MaxPathLength = 400;

    public const int DefaultWindowDays = 7;

    /// <summary>How far back the chart's (usual for this weekday) line is averaged over.</summary>
    private const int BaselineWeeks = 4;

    private const int ReferrerLimit = 10;

    private const int TopPostLimit = 5;

    private readonly IAnalyticsRepository _analytics;
    private readonly IPostRepository _posts;
    private readonly ICurrentUser _currentUser;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly TimeProvider _timeProvider;
    private readonly AnalyticsOptions _options;

    public AnalyticsService(
        IAnalyticsRepository analytics,
        IPostRepository posts,
        ICurrentUser currentUser,
        IHttpContextAccessor httpContextAccessor,
        TimeProvider timeProvider,
        IOptions<AnalyticsOptions> options)
    {
        _analytics = analytics;
        _posts = posts;
        _currentUser = currentUser;
        _httpContextAccessor = httpContextAccessor;
        _timeProvider = timeProvider;
        _options = options.Value;
    }

    public async Task RecordAsync(TrackViewDto dto, CancellationToken cancellationToken = default)
    {
        var now = _timeProvider.GetUtcNow();

        // NOTE: a draft is not counted for time metrics collection.
        Post? post = null;
        if (!string.IsNullOrWhiteSpace(dto.Slug))
        {
            post = await _posts.GetBySlugAsync(
                dto.Slug.Trim().ToLowerInvariant(),
                tracked: true,
                cancellationToken);

            if (post is not null && post.IsDraft)
                post = null;
        }

        var view = new PageView
        {
            PostId = post?.Id,
            AuthorId = post?.AuthorId,
            Path = Truncate(dto.Path.Trim(), MaxPathLength),
            VisitorHash = ComputeVisitorHash(now),
            ReferrerHost = NormalizeReferrerHost(dto.Referrer),
            DwellSeconds = Math.Clamp(dto.DwellSeconds, 0, MaxRecordSecs),
            OccurredAt = now
        };

        await _analytics.AddAsync(view, cancellationToken);

        if (post is not null)
            post.ViewCount++;

        await _analytics.SaveChangesAsync(cancellationToken);
    }

    public async Task<AnalyticsSummaryDto> GetSummaryAsync(
        int windowDays,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var days = NormalizeWindow(windowDays);

        var now = _timeProvider.GetUtcNow();

        // TODO: set a caching module here if the load become too much
        // Set duration to last week and last last week
        var to = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero).AddDays(1);
        var from = to.AddDays(-days);
        var previousFrom = from.AddDays(-days);

        var current = await _analytics.GetTotalsAsync(authorId, from, to, cancellationToken);
        var previous = await _analytics.GetTotalsAsync(authorId, previousFrom, from, cancellationToken);

        // Get base line info (range by number of BaseLineWeeks, default to 4)
        var daily = await _analytics.GetDailyAsync(authorId, from, to, cancellationToken);
        var baselineFrom = from.AddDays(-7 * BaselineWeeks);
        var baselineRows = await _analytics.GetDailyAsync(authorId, baselineFrom, from, cancellationToken);

        var referrers = await _analytics.GetReferrersAsync(authorId, from, to, ReferrerLimit, cancellationToken);
        var topPosts = await _analytics.GetTopPostsAsync(authorId, from, to, TopPostLimit, cancellationToken);

        return new AnalyticsSummaryDto
        {
            WindowDays = days,
            From = from,
            To = to,
            UniqueVisitors = MetricDto.From(current.UniqueVisitors, previous.UniqueVisitors),
            Reads = MetricDto.From(current.Reads, previous.Reads),
            AvgDwellSeconds = MetricDto.From(current.AvgDwellSeconds, previous.AvgDwellSeconds),
            Daily = BuildDailySeries(from, days, daily, baselineRows),
            Referrers = BuildReferrers(referrers, current.Reads),
            TopPosts = topPosts
                .Select(p => new TopPostDto
                {
                    PostId = p.PostId,
                    Title = p.Title,
                    Slug = p.Slug,
                    Summary = p.Summary,
                    Reads = p.Reads,
                    Share = Share(p.Reads, current.Reads)
                })
                .ToList()
        };
    }

    public async Task<string> ExportCsvAsync(int windowDays, CancellationToken cancellationToken = default)
    {
        var summary = await GetSummaryAsync(windowDays, cancellationToken);

        var csv = new StringBuilder();
        csv.AppendLine("date,visitors,reads,baseline");

        foreach (var day in summary.Daily)
        {
            csv.Append(day.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).Append(',')
                .Append(day.Visitors.ToString(CultureInfo.InvariantCulture)).Append(',')
                .Append(day.Reads.ToString(CultureInfo.InvariantCulture)).Append(',')
                .AppendLine(day.Baseline.ToString("0.##", CultureInfo.InvariantCulture));
        }

        return csv.ToString();
    }

    /// <summary>Build daily summary of reads with baseline from incremented to n days</summary>
    private static IReadOnlyList<DailyTrafficDto> BuildDailySeries(
        DateTimeOffset from,
        int days,
        IReadOnlyList<DailyTrafficRow> rows,
        IReadOnlyList<DailyTrafficRow> baselineRows)
    {
        // NOTE: turn rows (list) to dict, e.g. [{date: 1, name: 1}] -> {date: {date: 1, name: 1}}
        var byDate = rows.ToDictionary(r => r.Date);

        // Group by DayOfWeek within the records, convert to dictionary with DOW as key
        // and average as value, e.g. {Monday: 1}
        var baselineByWeekday = baselineRows
            .GroupBy(r => r.Date.DayOfWeek)
            .ToDictionary(g => g.Key, g => g.Average(r => r.Reads));

        var series = new List<DailyTrafficDto>(days);

        for (var offset = 0; offset < days; offset++)
        {
            var date = DateOnly.FromDateTime(from.UtcDateTime.Date.AddDays(offset));
            byDate.TryGetValue(date, out var row);

            series.Add(new DailyTrafficDto
            {
                Date = date,
                Visitors = row?.Visitors ?? 0,
                Reads = row?.Reads ?? 0,
                Baseline = baselineByWeekday.TryGetValue(date.DayOfWeek, out var baseline) ? baseline : 0d
            });
        }

        return series;
    }

    private static IReadOnlyList<ReferrerDto> BuildReferrers(
        IReadOnlyList<ReferrerRow> rows,
        int totalReads) =>
        rows
            .Select(r => new ReferrerDto
            {
                Host = r.Host,
                UniqueVisitors = r.Visitors,
                Reads = r.Reads,
                Share = Share(r.Reads, totalReads),
                AvgDwellSeconds = r.AvgDwellSeconds
            })
            .ToList();

    // Calculate the relative fractional share of part to total
    private static double Share(int part, int total) => total <= 0 ? 0d : part / (double)total;

    private static int NormalizeWindow(int windowDays) =>
        windowDays <= 0 ? DefaultWindowDays : Math.Clamp(windowDays, MinWindowDays, MaxWindowDays);

    /// <summary>Return the reader's id based on available information</summary>
    private string ComputeVisitorHash(DateTimeOffset now)
    {
        var context = _httpContextAccessor.HttpContext;

        var address = context?.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var userAgent = context?.Request.Headers.UserAgent.ToString() ?? string.Empty;
        var day = now.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        var material = $"{_options.VisitorSalt}|{day}|{address}|{userAgent}";
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(material));

        return Convert.ToHexString(digest);
    }

    /// <summary>
    /// Reduces a referrer to the host the reader came from, or null for "direct". Anything
    /// unparseable is direct too: the field is whatever the browser handed over, and a
    /// referrer nobody can read is not a source worth inventing a row for.
    /// </summary>
    private string? NormalizeReferrerHost(string? referrer)
    {
        if (string.IsNullOrWhiteSpace(referrer))
            return null;

        // Valid URI check
        if (!Uri.TryCreate(referrer.Trim(), UriKind.Absolute, out var uri))
            return null;

        var host = uri.Host.ToLowerInvariant();

        // Remove the www. for only the host name
        if (host.StartsWith("www.", StringComparison.Ordinal))
            host = host[4..];

        if (string.IsNullOrEmpty(host))
            return null;

        // Return null if user is just navigating to our owned website
        if (_options.SelfHosts.Any(self => string.Equals(self, host, StringComparison.OrdinalIgnoreCase)))
            return null;

        return Truncate(host, 255);
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];
}
