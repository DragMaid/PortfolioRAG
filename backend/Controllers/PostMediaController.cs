using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// The media attached to a post. Authoring only: everything here is scoped to the
/// signed-in author's own posts. Readers reach the files through GET /api/media/{id}/content,
/// which is what the returned <see cref="MediaDto.Url"/> points at.
/// </summary>
[ApiController]
[Route("api/admin/posts/{postId:int}/media")]
[Produces("application/json")]
[Authorize]
public class PostMediaController : ControllerBase
{
    private readonly IMediaService _mediaService;

    public PostMediaController(IMediaService mediaService)
    {
        _mediaService = mediaService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MediaDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<MediaDto>>> GetAll(
        int postId,
        CancellationToken cancellationToken) =>
        Ok(await _mediaService.GetForPostAsync(postId, cancellationToken));

    /// <summary>
    /// Uploads a file and attaches it to your post. The type is decided by what the bytes
    /// are, not by the name or the declared content type; pictures are scaled down and
    /// re-encoded, and the file is stored under a generated name.
    /// </summary>
    /// <param name="role">
    /// What the file is for.
    /// <c>Attachment</c> is an ordinary file, can be anything
    /// <c>Thumbnail</c> is a supported image file
    /// <c>Trailer</c> is either a image or video format file
    /// </param>
    [HttpPost]
    [Consumes("multipart/form-data")]
    // NOTE: disable body limit as new limiter is bounded by FormOptions.MultipartBodyLengthLimit
    [DisableRequestSizeLimit]
    [ProducesResponseType(typeof(MediaDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status415UnsupportedMediaType)]
    public async Task<ActionResult<MediaDto>> Upload(
        int postId,
        IFormFile file,
        [FromQuery] MediaRole role,
        CancellationToken cancellationToken)
    {
        var media = await _mediaService.AddToPostAsync(postId, file, role, cancellationToken);

        return CreatedAtAction(
            nameof(MediaController.GetContent),
            "Media",
            new { id = media.Id },
            media);
    }

    // Update the file metadata, not the actual file itself
    [HttpPut("{mediaId:int}")]
    [ProducesResponseType(typeof(MediaDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MediaDto>> Update(
        int postId,
        int mediaId,
        [FromBody] UpdateMediaDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _mediaService.UpdateAsync(postId, mediaId, dto, cancellationToken));

    [HttpDelete("{mediaId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int postId, int mediaId, CancellationToken cancellationToken)
    {
        await _mediaService.DeleteAsync(postId, mediaId, cancellationToken);
        return NoContent();
    }
}
