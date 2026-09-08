using Backend.Models.DTOs;
using Backend.Models.Requests;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// The public blog. Only published posts are reachable here — a draft is a 404 to
/// everyone, including its own author, who reads it through /api/admin/posts instead.
/// </summary>
[ApiController]
[Route("api/posts")]
[Produces("application/json")]
[AllowAnonymous]
public class PostsController : ControllerBase
{
    private readonly IPostService _postService;
    private readonly IMediaService _mediaService;

    public PostsController(IPostService postService, IMediaService mediaService)
    {
        _postService = postService;
        _mediaService = mediaService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PostSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PagedResult<PostSummaryDto>>> GetPublished(
        [FromQuery] PostQueryRequest request,
        CancellationToken cancellationToken) =>
        Ok(await _postService.GetPublicAsync(request, cancellationToken));

    [HttpGet("{slug}")]
    [ProducesResponseType(typeof(PostDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostDto>> GetBySlug(string slug, CancellationToken cancellationToken) =>
        Ok(await _postService.GetPublicBySlugAsync(slug, cancellationToken));

    /// <summary>
    /// The files attached to a published post. The body usually embeds them already; this
    /// is for anything that needs the list itself, a gallery or a cover image.
    /// </summary>
    [HttpGet("{slug}/media")]
    [ProducesResponseType(typeof(IReadOnlyList<MediaDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<MediaDto>>> GetMedia(
        string slug,
        CancellationToken cancellationToken) =>
        Ok(await _mediaService.GetForPublicPostAsync(slug, cancellationToken));

    [HttpPost("{slug}/views")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<object>> RegisterView(string slug, CancellationToken cancellationToken)
    {
        var viewCount = await _postService.RegisterViewAsync(slug, cancellationToken);
        return Ok(new { slug, viewCount });
    }
}
