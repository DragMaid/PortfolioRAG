using Backend.Models.Entities;

namespace Backend.Services;

public interface IMediaTypeDetector
{
    /// <summary>
    /// Identifies content from its bytes, or null when it is not something a post may embed.
    /// </summary>
    /// <remarks>
    /// The declared content type and the uploaded filename are both attacker-controlled, so
    /// neither takes part: a .png that is really an executable is refused here rather than
    /// stored and served back as an image.
    /// </remarks>
    /// <param name="content">
    /// Must be seekable — the signatures being matched sit at different offsets, and one
    /// format is settled by reading into the body. The stream is left rewound.
    /// </param>
    MediaExtension? Detect(Stream content);
}
