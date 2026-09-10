namespace Backend.Models.Entities;

/// <summary>One reading of one page, as reported by the browser.</summary>
public class PageView
{
    public long Id { get; set; }

    /// <summary>The post that was read, or null when the page was not a post (the landing page).</summary>
    public int? PostId { get; set; }

    public Post? Post { get; set; }

    /// <summary>
    /// The author the reading belongs to, copied off the post so the dashboard can scope a
    /// query without joining. Null for pages that are not a post, which therefore belong to
    /// nobody and appear in nobody's dashboard.
    /// </summary>
    // TODO(review): a site-level "owner" would let landing-page traffic show up somewhere.
    // Attributing it to an arbitrary author instead would break the rule that an author only
    // ever sees their own numbers, so it is left unattributed until that concept exists.
    public int? AuthorId { get; set; }

    public Author? Author { get; set; }

    /// <summary>The path that was read, for pages with no post behind them.</summary>
    public string Path { get; set; } = string.Empty;

    /// <summary>
    /// Salted hash of the caller's address and user agent. The salt rotates at midnight UTC,
    /// so this counts a returning reader once within a day and cannot be linked across days
    /// or back to an address.
    /// </summary>
    public string VisitorHash { get; set; } = string.Empty;

    /// <summary>
    /// Host the reader arrived from, lowercased and stripped of "www." — "news.ycombinator.com".
    /// Null means direct: no referrer, or one from this site itself.
    /// </summary>
    public string? ReferrerHost { get; set; }

    /// <summary>
    /// How long the page was open, in seconds, as measured by the browser. Zero when the
    /// reader left before the beacon could report it, and those are left out of averages.
    /// </summary>
    public int DwellSeconds { get; set; }

    public DateTimeOffset OccurredAt { get; set; }
}
