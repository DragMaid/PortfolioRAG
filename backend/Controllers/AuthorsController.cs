using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

[ApiController]
[Route("api/authors")]
[Produces("application/json")]
public class AuthorsController : ControllerBase
{
    private readonly IAuthorService _authorService;

    public AuthorsController(IAuthorService authorService)
    {
        _authorService = authorService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AuthorDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AuthorDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await _authorService.GetAllAsync(cancellationToken));

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(AuthorDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AuthorDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await _authorService.GetByIdAsync(id, cancellationToken));

    [HttpPost]
    [ProducesResponseType(typeof(AuthorDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthorDto>> Create(
        [FromBody] CreateAuthorDto dto,
        CancellationToken cancellationToken)
    {
        var author = await _authorService.CreateAsync(dto, cancellationToken);
        // NOTE: this also show where the created object can be retrieved, here its GetById above
        return CreatedAtAction(nameof(GetById), new { id = author.Id }, author);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(AuthorDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthorDto>> Update(
        int id,
        [FromBody] UpdateAuthorDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _authorService.UpdateAsync(id, dto, cancellationToken));

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    // TODO: I have not yet put 409 for if user still has posts,
    // might as well just define removing posts with the use of
    // something like github write title to confirm
    // [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await _authorService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
