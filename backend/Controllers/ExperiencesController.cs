using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// The jobs on an author's timeline. Reads are public, like the profile they belong to;
/// an author may only add to and change their own.
/// </summary>
[ApiController]
[Route("api/experiences")]
[Produces("application/json")]
[Authorize]
public class ExperiencesController : ControllerBase
{
    private readonly IAuthorService _authorService;
    private readonly IMediaService _mediaService;

    public ExperiencesController(IAuthorService authorService, IMediaService mediaService)
    {
        _authorService = authorService;
        _mediaService = mediaService;
    }

    /// <summary>One author's timeline, oldest first.</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<ExperienceDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ExperienceDto>>> GetAll(
        [FromQuery] int authorId,
        CancellationToken cancellationToken) =>
        Ok(await _authorService.GetExperiencesAsync(authorId, cancellationToken));

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ExperienceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ExperienceDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await _authorService.GetExperienceAsync(id, cancellationToken));

    /// <summary>Adds a job to your own timeline.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ExperienceDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ExperienceDto>> Create(
        [FromBody] ExperienceInputDto dto,
        CancellationToken cancellationToken)
    {
        var created = await _authorService.AddExperienceAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    /// <summary>Rewrites one of your own jobs.</summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ExperienceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ExperienceDto>> Update(
        int id,
        [FromBody] ExperienceInputDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _authorService.UpdateExperienceAsync(id, dto, cancellationToken));

    /// <summary>Removes one of your own jobs, and the company mark it carried.</summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await _authorService.DeleteExperienceAsync(id, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Redirects to a company mark. Public, like the timeline it is drawn on, and a 404
    /// for a job that never had one uploaded.
    /// </summary>
    [HttpGet("{id:int}/logo")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status302Found)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLogo(int id, CancellationToken cancellationToken)
    {
        var url = await _mediaService.GetExperienceLogoUrlAsync(id, cancellationToken);

        // The link behind this expires, so nothing between here and the reader may keep it.
        Response.Headers.CacheControl = "private, no-store";

        return Redirect(url.ToString());
    }

    /// <summary>
    /// Replaces the company mark on one of your own jobs. Scaled and re-encoded on the way
    /// in, like an avatar.
    /// </summary>
    [HttpPut("{id:int}/logo")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ExperienceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status415UnsupportedMediaType)]
    public async Task<ActionResult<ExperienceDto>> SetLogo(
        int id,
        IFormFile file,
        CancellationToken cancellationToken) =>
        Ok(await _mediaService.SetExperienceLogoAsync(id, file, cancellationToken));

    /// <summary>Drops the company mark, leaving the timeline to fall back to a lettermark.</summary>
    [HttpDelete("{id:int}/logo")]
    [ProducesResponseType(typeof(ExperienceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ExperienceDto>> RemoveLogo(
        int id,
        CancellationToken cancellationToken) =>
        Ok(await _mediaService.RemoveExperienceLogoAsync(id, cancellationToken));
}
