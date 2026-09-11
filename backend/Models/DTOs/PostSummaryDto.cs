namespace Backend.Models.DTOs;

public class PostSummaryDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Slug { get; init; } = string.Empty;

    public string? Summary { get; init; }

    public bool IsDraft { get; init; }

    /// <summary>Whether the post is the showcase piece the portfolio leads with.</summary>
    public bool IsFeatured { get; init; }

    public AuthorSummaryDto Author { get; init; } = new();

    public int ViewCount { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? PublishedAt { get; init; }

    /// <summary>The kicker beside the ordinal on the card — "VECTOR CORE".</summary>
    public string? Category { get; init; }

    /// <summary>The line in the card footer — "Vector Storage".</summary>
    public string? Domain { get; init; }

    public string? RepoUrl { get; init; }

    public string? DemoUrl { get; init; }

    public string? SpecUrl { get; init; }

    /// <summary>
    /// The card image. Null only while the post is still a draft — publishing requires it,
    /// so nothing the public reads ever has one missing.
    /// </summary>
    public MediaDto? Thumbnail { get; init; }

    /// <summary>
    /// The preview reel, a video or a still. Required to publish, exactly as the thumbnail is.
    /// </summary>
    public MediaDto? Trailer { get; init; }
}
