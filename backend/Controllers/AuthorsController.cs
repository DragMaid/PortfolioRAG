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

    public AuthorsController(IAuthorService authorService)
    {
        _authorService = authorService;
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
