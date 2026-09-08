using Backend.Models.Entities;

namespace Backend.Common;

/// <summary>
/// What the API knows about each file type a post may embed, keyed off
/// <see cref="MediaExtension"/> so the closed set in the entity stays the single source of
/// truth. Recognising content is a separate job — see <see cref="Services.IMediaTypeDetector"/>.
/// </summary>
public static class MediaFormats
{
    public static string ToContentType(this MediaExtension extension) => extension switch
    {
        MediaExtension.Png => "image/png",
        MediaExtension.Jpeg => "image/jpeg",
        MediaExtension.Gif => "image/gif",
        MediaExtension.Webp => "image/webp",
        MediaExtension.Mp4 => "video/mp4",
        MediaExtension.Webm => "video/webm",
        _ => "application/octet-stream"
    };

    public static string ToFileExtension(this MediaExtension extension) => extension switch
    {
        MediaExtension.Png => ".png",
        MediaExtension.Jpeg => ".jpg",
        MediaExtension.Gif => ".gif",
        MediaExtension.Webp => ".webp",
        MediaExtension.Mp4 => ".mp4",
        MediaExtension.Webm => ".webm",
        _ => string.Empty
    };

    public static bool IsVideo(this MediaExtension extension) =>
        extension is MediaExtension.Mp4 or MediaExtension.Webm;

    /// <summary>
    /// Pixel formats that can be decoded, resized and re-encoded. Video is left to whatever
    /// the author already compressed.
    /// </summary>
    public static bool IsRaster(this MediaExtension extension) =>
        extension is MediaExtension.Png or MediaExtension.Jpeg or MediaExtension.Gif or MediaExtension.Webp;
}
