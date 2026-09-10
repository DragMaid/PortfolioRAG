using Backend.Models.DTOs.Analytics;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>Route to report record for analytical purposes</summary>
[ApiController]
[Route("api/analytics")]
[Produces("application/json")]
[AllowAnonymous]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analytics;

    public AnalyticsController(IAnalyticsService analytics)
    {
        _analytics = analytics;
    }

    [HttpPost("views")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RecordView(
        [FromBody] TrackViewDto dto,
        CancellationToken cancellationToken)
    {
        await _analytics.RecordAsync(dto, cancellationToken);
        return Accepted();
    }
}
