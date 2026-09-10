namespace Backend.Models.Entities;

// NOTE: apparently the annotations shouldn't be included here also
// Instead its actually preferable that we really just put it in configuration
public class Post
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    // NOTE: this is a URL friendly identifier instead of just a UUID
    public string Slug { get; set; } = string.Empty;

    public string? Summary { get; set; }

    public string Body { get; set; } = string.Empty;

    public bool IsDraft { get; set; } = true;

    /// <summary>Marks the post as the showcase piece the portfolio leads with</summary>
    public bool IsFeatured { get; set; }

    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset? PublishedAt { get; set; }

    public int ViewCount { get; set; }

    public ICollection<Media> Medias { get; set; } = new List<Media>();
}
