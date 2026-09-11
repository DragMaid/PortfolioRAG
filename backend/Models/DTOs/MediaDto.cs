using Backend.Models.Entities;

namespace Backend.Models.DTOs;

public class MediaDto
{
    public int Id { get; init; }

    /// <summary>The name the file was uploaded under, for display.</summary>
    public string Filename { get; init; } = string.Empty;

    public string Url { get; init; } = string.Empty;

    public MediaExtension Extension { get; init; }

    /// <summary>Whether this is the post's thumbnail, its trailer, or a plain attachment.</summary>
    public MediaRole Role { get; init; }

    /// <summary>What the file is for, in the author's words. Null until one is written.</summary>
    public string? Caption { get; init; }

    /// <summary>Size of the stored file, after optimization.</summary>
    public long ByteSize { get; init; }

    public int PostId { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
