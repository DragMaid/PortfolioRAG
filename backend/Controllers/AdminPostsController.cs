using Backend.Models.DTOs;
using Backend.Models.Requests;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Authoring endpoints. Every action here is scoped to the signed-in author: they see
/// their own drafts, and they create, edit, publish and delete only their own posts.
/// Nobody can act on another author's behalf.
/// </summary>
[ApiController]
[Route("api/admin/posts")]
[Produces("application/json")]
[Authorize]
public class AdminPostsController : ControllerBase
{
    private readonly IPostService _postService;

    public AdminPostsController(IPostService postService)
    {
        _postService = postService;
    }

    /// <summary>Your own posts, drafts included. The AuthorId filter is ignored here.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PostSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<PagedResult<PostSummaryDto>>> GetAll(
        [FromQuery] PostQueryRequest request,
        CancellationToken cancellationToken) =>
        Ok(await _postService.GetByDraftAsync(request, request.IsDraft, cancellationToken));

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await _postService.GetByIdAsync(id, cancellationToken));

    /// <summary>Creates a draft owned by you. The author comes from your access token.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
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
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PostDto>> Update(
        int id,
        [FromBody] UpdatePostDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _postService.UpdateAsync(id, dto, cancellationToken));

    [HttpPost("{id:int}/publish")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> Publish(int id, CancellationToken cancellationToken) =>
        Ok(await _postService.PublishAsync(id, cancellationToken));

    [HttpPost("{id:int}/unpublish")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> Unpublish(int id, CancellationToken cancellationToken) =>
        Ok(await _postService.UnpublishAsync(id, cancellationToken));

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await _postService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
