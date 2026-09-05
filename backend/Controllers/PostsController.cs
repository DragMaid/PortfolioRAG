using Backend.Models.DTOs;
using Backend.Models.Requests;
using Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

[ApiController]
[Route("api/posts")]
[Produces("application/json")]
public class PostsController : ControllerBase
{
    private readonly IPostService _postService;

    public PostsController(IPostService postService)
    {
        _postService = postService;
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

    [HttpPost("{slug}/views")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<object>> RegisterView(string slug, CancellationToken cancellationToken)
    {
        var viewCount = await _postService.RegisterViewAsync(slug, cancellationToken);
        return Ok(new { slug, viewCount });
    }
}
