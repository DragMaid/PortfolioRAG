using System.Text;
using Backend.Models.Entities;

namespace Backend.Common;

/// <summary>
/// Everything the API knows about the file types a post may embed, keyed off
/// <see cref="MediaExtension"/> so the closed set in the entity stays the single source of
/// truth.
/// </summary>
public static class MediaFormats
{
    /// <summary>
    /// Bytes of the leading header <see cref="TryDetect"/> needs. WebP is the greediest —
    /// its marker sits at offset 8 — and SVG may be preceded by a BOM and whitespace.
    /// </summary>
    public const int HeaderBytes = 64;

    public static string ToContentType(this MediaExtension extension) => extension switch
    {
        MediaExtension.Png => "image/png",
        MediaExtension.Jpeg => "image/jpeg",
        MediaExtension.Gif => "image/gif",
        MediaExtension.Webp => "image/webp",
        MediaExtension.Svg => "image/svg+xml",
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
        MediaExtension.Svg => ".svg",
        MediaExtension.Mp4 => ".mp4",
        MediaExtension.Webm => ".webm",
        _ => string.Empty
    };

    public static bool IsVideo(this MediaExtension extension) =>
        extension is MediaExtension.Mp4 or MediaExtension.Webm;

    /// <summary>
    /// Pixel formats that can be decoded, resized and re-encoded. SVG is an image but is
    /// markup, not pixels, and video is left to whatever the author already compressed.
    /// </summary>
    public static bool IsRaster(this MediaExtension extension) =>
        extension is MediaExtension.Png or MediaExtension.Jpeg or MediaExtension.Gif or MediaExtension.Webp;

    /// TODO: the detection should rather be done by an external library though, implementin it was fun though
    /// <summary>
    /// Identifies content from its leading bytes. The declared content type and the
    /// filename are both attacker-controlled, so neither takes part: a .png that is really
    /// an executable is rejected here rather than stored and served back as an image.
    /// </summary>
    public static bool TryDetect(ReadOnlySpan<byte> header, out MediaExtension extension)
    {
        extension = default;

        if (header.Length >= 8 && header[..8].SequenceEqual(stackalloc byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            extension = MediaExtension.Png;
            return true;
        }

        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
        {
            extension = MediaExtension.Jpeg;
            return true;
        }

        if (header.Length >= 6 && (StartsWithAscii(header, "GIF87a") || StartsWithAscii(header, "GIF89a")))
        {
            extension = MediaExtension.Gif;
            return true;
        }

        // RIFF....WEBP — the four bytes between the two markers are the chunk length.
        if (header.Length >= 12 && StartsWithAscii(header, "RIFF") && MatchesAscii(header[8..12], "WEBP"))
        {
            extension = MediaExtension.Webp;
            return true;
        }

        // ISO base media: the 'ftyp' box sits at offset 4. That covers MP4 as well as the
        // MOV/M4V relatives, all of which browsers play from a video/mp4 response.
        if (header.Length >= 8 && MatchesAscii(header[4..8], "ftyp"))
        {
            extension = MediaExtension.Mp4;
            return true;
        }

        // EBML header — Matroska and its WebM subset share it.
        if (header.Length >= 4 && header[..4].SequenceEqual(stackalloc byte[] { 0x1A, 0x45, 0xDF, 0xA3 }))
        {
            extension = MediaExtension.Webm;
            return true;
        }

        if (LooksLikeSvg(header))
        {
            extension = MediaExtension.Svg;
            return true;
        }

        return false;
    }

    // TODO: similarly remove this also
    private static bool LooksLikeSvg(ReadOnlySpan<byte> header)
    {
        // NOTE: an SVG is text, so it may open with a BOM, a declaration, a doctype or a
        // comment before the root element ever appears. Only the start of the document is
        // in hand here; the parse in the optimizer is what actually settles it.
        if (header.StartsWith(stackalloc byte[] { 0xEF, 0xBB, 0xBF }))
        {
            header = header[3..];
        }

        var text = Encoding.UTF8.GetString(header).TrimStart();

        return text.StartsWith("<?xml", StringComparison.OrdinalIgnoreCase)
            || text.StartsWith("<svg", StringComparison.OrdinalIgnoreCase)
            || text.StartsWith("<!DOCTYPE svg", StringComparison.OrdinalIgnoreCase);
    }

    private static bool StartsWithAscii(ReadOnlySpan<byte> header, string value) =>
        header.Length >= value.Length && MatchesAscii(header[..value.Length], value);

    private static bool MatchesAscii(ReadOnlySpan<byte> bytes, string value)
    {
        for (var i = 0; i < value.Length; i++)
        {
            if (bytes[i] != value[i])
                return false;
        }

        return true;
    }
}
