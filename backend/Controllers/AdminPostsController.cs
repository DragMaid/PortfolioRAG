using Backend.Models.DTOs;
using Backend.Models.Requests;
using Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Authoring endpoints: drafts posts are visible here as well.
/// Actions performed by authorized users like creation, publishing, etc is here also 
/// </summary>
[ApiController]
[Route("api/admin/posts")]
[Produces("application/json")]
public class AdminPostsController : ControllerBase
{
    // TODO: no authentication is wired up yet — put these behind an auth policy before deploying.
    private readonly IPostService _postService;

    public AdminPostsController(IPostService postService)
    {
        _postService = postService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PostSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PagedResult<PostSummaryDto>>> GetAll(
        [FromQuery] PostQueryRequest request,
        CancellationToken cancellationToken) =>
        // TODO: this generic function call might not be the best idea
        // maybe move over to business level functions would be more readable
        Ok(await _postService.GetByDraftAsync(request, isDraft: null, cancellationToken));

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await _postService.GetByIdAsync(id, cancellationToken));

    [HttpPost]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PostDto>> Create(
        [FromBody] CreatePostDto dto,
        CancellationToken cancellationToken)
    {
        var post = await _postService.CreateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = post.Id }, post);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PostDto>> Update(
        int id,
        [FromBody] UpdatePostDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _postService.UpdateAsync(id, dto, cancellationToken));

    [HttpPost("{id:int}/publish")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> Publish(int id, CancellationToken cancellationToken) =>
        Ok(await _postService.PublishAsync(id, cancellationToken));

    [HttpPost("{id:int}/unpublish")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> Unpublish(int id, CancellationToken cancellationToken) =>
        Ok(await _postService.UnpublishAsync(id, cancellationToken));

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await _postService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
