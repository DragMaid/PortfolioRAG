namespace Backend.Models.Entities;

/// <summary>
/// The file types a post may embed. A closed set rather than free text: the extension
/// decides how the frontend renders the item and what the upload endpoint will accept,
/// and neither can act on a value it does not know.
/// </summary>
public enum MediaExtension
{
    Png = 0,
    Jpeg = 1,
    Gif = 2,
    Webp = 3,
    Mp4 = 5,
    Webm = 6
}

public class Media
{
    public int Id { get; set; }

    public string Filename { get; set; } = String.Empty;

    /// <summary>
    /// Where the bytes live in the bucket. Not an address: the bucket is private, so a
    /// reader is sent to a signed link minted on demand
    /// </summary>
    public string ObjectKey { get; set; } = String.Empty;

    /// <summary>Size of the stored object, which is post-optimization and rarely what was uploaded.</summary>
    public long ByteSize { get; set; }

    public MediaExtension Extension { get; set; }

    /// <summary>
    /// What the file is for, in the author's words — "Hero architecture figure". Shown
    /// beside the item in the asset list and used as the alt text when the editor inserts
    /// it into the body, so it is worth writing even though nothing requires it.
    /// </summary>
    public string? Caption { get; set; }

    public int PostId { get; set; }

    public Post Post { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }
}
