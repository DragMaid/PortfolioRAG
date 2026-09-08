using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Serves the files attached to posts. The bucket is private so no caching shall be performed
/// </summary>
[ApiController]
[Route("api/media")]
public class MediaController : ControllerBase
{
    private readonly IMediaService _mediaService;

    public MediaController(IMediaService mediaService)
    {
        _mediaService = mediaService;
    }

    [HttpGet("{id:int}/content")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status302Found)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetContent(int id, CancellationToken cancellationToken)
    {
        var url = await _mediaService.GetContentUrlAsync(id, cancellationToken);

        // NOTE: the redirect itself must not be cached. It carries a token with a deadline
        // on it, and a cache that kept the 302 would keep serving that token which is annoying
        Response.Headers.CacheControl = "private, no-store";

        return Redirect(url.ToString());
    }
}
