namespace Backend.Models.Entities;

/// <summary>
/// The file types a post may embed. A closed set rather than free text: the extension
/// decides how the frontend renders the item and what the eventual upload endpoint will
/// accept, and neither can act on a value it does not know.
/// </summary>
public enum MediaExtension
{
    Png = 0,
    Jpeg = 1,
    Gif = 2,
    Webp = 3,
    Svg = 4,
    Mp4 = 5,
    Webm = 6
}

public class Media
{ 
    public int Id { get; set; } 

    public string Filename { get; set; } = String.Empty;

    public string Url { get; set; } = String.Empty;

    public MediaExtension Extension { get; set; }

    public int PostId { get; set; }

    public Post Post { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }
}
