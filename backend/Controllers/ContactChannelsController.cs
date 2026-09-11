using Backend.Models.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// The ways of reaching an author. Reads are public; an author may only change their own.
///
/// A channel is a label and an address and nothing else — which service the address belongs
/// to is worked out by whoever renders it, so any address at all can be stored here.
/// </summary>
[ApiController]
[Route("api/contact-channels")]
[Produces("application/json")]
[Authorize]
public class ContactChannelsController : ControllerBase
{
    private readonly IAuthorService _authorService;

    public ContactChannelsController(IAuthorService authorService)
    {
        _authorService = authorService;
    }

    /// <summary>One author's contact links, in the order they set.</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<ContactChannelDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ContactChannelDto>>> GetAll(
        [FromQuery] int authorId,
        CancellationToken cancellationToken) =>
        Ok(await _authorService.GetContactChannelsAsync(authorId, cancellationToken));

    /// <summary>Adds a link to your own profile.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ContactChannelDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ContactChannelDto>> Create(
        [FromBody] ContactChannelInputDto dto,
        CancellationToken cancellationToken)
    {
        var created = await _authorService.AddContactChannelAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { authorId = created.AuthorId }, created);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ContactChannelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ContactChannelDto>> Update(
        int id,
        [FromBody] ContactChannelInputDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _authorService.UpdateContactChannelAsync(id, dto, cancellationToken));

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await _authorService.DeleteContactChannelAsync(id, cancellationToken);
        return NoContent();
    }
}
