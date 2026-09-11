namespace Backend.Models.Entities;

public class ContactChannel
{
    public int Id { get; set; }

    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    /// <summary>What the profile card prints — "github.com/avance".</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>Stored as the author typed it. Any address is allowed, including one with no scheme</summary>
    public string Url { get; set; } = string.Empty;

    // TODO: i thought this was a cool feature but we'll see how it goes
    /// <summary>The footer's longer wording — "GitHub (@avance)". Optional: the footer prints<see cref="Label"/> when this is not set.</summary>
    public string? Handle { get; set; }

    /// <summary>Display position. Set by the author, since nothing about a link implies an order.</summary>
    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
