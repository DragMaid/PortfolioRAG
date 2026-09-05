namespace Backend.Models.DTOs;

public class PostDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Slug { get; init; } = string.Empty;

    public string? Summary { get; init; }

    public string Body { get; init; } = string.Empty;

    public bool IsDraft { get; init; }

    public AuthorSummaryDto Author { get; init; } = new();

    public int ViewCount { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; init; }

    public DateTimeOffset? PublishedAt { get; init; }
}
