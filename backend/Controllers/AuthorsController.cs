using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Author profiles. Reads are public; an author may only modify their own account.
/// </summary>
[ApiController]
[Route("api/authors")]
[Produces("application/json")]
[Authorize]
public class AuthorsController : ControllerBase
{
    private readonly IAuthorService _authorService;
    private readonly IMediaService _mediaService;

    public AuthorsController(IAuthorService authorService, IMediaService mediaService)
    {
        _authorService = authorService;
        _mediaService = mediaService;
    }

    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<AuthorDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AuthorDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await _authorService.GetAllAsync(cancellationToken));

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthorDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AuthorDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await _authorService.GetByIdAsync(id, cancellationToken));

    // NOTE: creating an author is POST /api/auth/register. There is no unauthenticated
    // way to mint an account here — that would let anyone squat an address, and any
    // account created without credentials could never be signed in to anyway.

    /// <summary>Updates your own profile.</summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(AuthorDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthorDto>> Update(
        int id,
        [FromBody] UpdateAuthorDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _authorService.UpdateAsync(id, dto, cancellationToken));

    /// <summary>
    /// Redirects to an author's uploaded avatar. Public, like the profile it belongs to,
    /// and a 404 for an account that never uploaded one — an avatar taken from a sign-in
    /// provider is already a plain URL on the profile.
    /// </summary>
    [HttpGet("{id:int}/avatar")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status302Found)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetAvatar(int id, CancellationToken cancellationToken)
    {
        var url = await _mediaService.GetAvatarUrlAsync(id, cancellationToken);

        // Make sure that the user's browser or shared CDN do not store the response
        Response.Headers.CacheControl = "private, no-store";

        return Redirect(url.ToString());
    }

    /// <summary>
    /// Replaces your own avatar. The picture is scaled down and re-encoded, and takes
    /// precedence over any AvatarUrl on the profile until you delete it again.
    /// </summary>
    [HttpPut("me/avatar")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(AuthorDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status415UnsupportedMediaType)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<AuthorDto>> SetAvatar(
        IFormFile file,
        CancellationToken cancellationToken) =>
        Ok(await _mediaService.SetAvatarAsync(file, cancellationToken));

    /// <summary>Drops your uploaded avatar, falling back to whatever a provider supplied.</summary>
    [HttpDelete("me/avatar")]
    [ProducesResponseType(typeof(AuthorDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<AuthorDto>> RemoveAvatar(CancellationToken cancellationToken) =>
        Ok(await _mediaService.RemoveAvatarAsync(cancellationToken));

    /// <summary>Deletes your own account. Refused while it still has posts.</summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await _authorService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
