using Backend.Models.Entities;
using FileSignatures;
using FileSignatures.Formats;

namespace Backend.Services;

/// <summary>
/// Maps what FileSignatures recognises onto the closed set of things a post may embed.
/// </summary>
/// <remarks>
/// Signature parsing used to live here by hand. It is the kind of code that is easy to
/// write and easy to get subtly wrong — the hand-rolled version matched the four EBML magic
/// bytes and so accepted any Matroska file as WebM.
/// </remarks>
public sealed class FileSignatureMediaTypeDetector : IMediaTypeDetector
{
    private readonly IFileFormatInspector _inspector;

    public FileSignatureMediaTypeDetector(IFileFormatInspector inspector)
    {
        _inspector = inspector;
    }

    public MediaExtension? Detect(Stream content)
    {
        content.Position = 0;
        var format = _inspector.DetermineFileFormat(content);
        content.Position = 0;

        // NOTE: Isobmff also covers QuickTime .mov and .3gp
        return format switch
        {
            Png => MediaExtension.Png,
            Jpeg => MediaExtension.Jpeg,
            Gif => MediaExtension.Gif,
            Webp => MediaExtension.Webp,
            WebM => MediaExtension.Webm,
            Isobmff => MediaExtension.Mp4,
            _ => null
        };
    }
}
