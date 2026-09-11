namespace Backend.Models.DTOs.Analytics;

public class AnalyticsSummaryDto
{
    /// <summary>Length of the window in days, as it was actually applied.</summary>
    public int WindowDays { get; init; }

    public DateTimeOffset From { get; init; }

    public DateTimeOffset To { get; init; }

    /// <summary>Distinct readers in the window. See the note on visitor hashing in <c>PageView</c>.</summary>
    public MetricDto UniqueVisitors { get; init; } = new();

    /// <summary>Post readings in the window, one per page view.</summary>
    public MetricDto Reads { get; init; } = new();

    /// <summary>Mean seconds a post stayed open, over the readings that reported a duration.</summary>
    public MetricDto AvgDwellSeconds { get; init; } = new();

    /// <summary>Readings per day, oldest first, with the baseline the chart draws behind them.</summary>
    public IReadOnlyList<DailyTrafficDto> Daily { get; init; } = Array.Empty<DailyTrafficDto>();

    /// <summary>Where the readers came from, busiest first.</summary>
    public IReadOnlyList<ReferrerDto> Referrers { get; init; } = Array.Empty<ReferrerDto>();

    /// <summary>The author's most-read posts in the window, busiest first.</summary>
    public IReadOnlyList<TopPostDto> TopPosts { get; init; } = Array.Empty<TopPostDto>();
}

public class MetricDto
{
    public double Value { get; init; }

    public double PreviousValue { get; init; }

    /// <summary>Fractional change against the previous window: 0.182 is +18.2%.</summary>
    public double? Change { get; init; }

    public static MetricDto From(double value, double previousValue) => new()
    {
        Value = value,
        PreviousValue = previousValue,
        Change = previousValue <= 0 ? null : (value - previousValue) / previousValue
    };
}

public class DailyTrafficDto
{
    public DateOnly Date { get; init; }

    public int Visitors { get; init; }

    public int Reads { get; init; }

    /// <summary>
    /// What this weekday usually looks like: the mean readership of the same weekday over
    /// the four weeks before the window. Zero until there is that much history.
    /// </summary>
    public double Baseline { get; init; }
}

public class ReferrerDto
{
    /// <summary>The sending host, or null for readers who arrived with no referrer.</summary>
    public string? Host { get; init; }

    public int UniqueVisitors { get; init; }

    public int Reads { get; init; }

    /// <summary>This host's share of the window's readings, 0-1.</summary>
    public double Share { get; init; }

    public double AvgDwellSeconds { get; init; }
}

public class TopPostDto
{
    public int PostId { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Slug { get; init; } = string.Empty;

    public string? Summary { get; init; }

    public int Reads { get; init; }

    /// <summary>This post's share of the window's readings, 0-1.</summary>
    public double Share { get; init; }
}
