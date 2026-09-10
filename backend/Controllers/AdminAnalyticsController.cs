using Backend.Models.DTOs.Analytics;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

[ApiController]
[Route("api/admin/analytics")]
[Produces("application/json")]
[Authorize]
public class AdminAnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analytics;

    public AdminAnalyticsController(IAnalyticsService analytics)
    {
        _analytics = analytics;
    }

    [HttpGet("summary")]
    [ProducesResponseType(typeof(AnalyticsSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AnalyticsSummaryDto>> GetSummary(
        [FromQuery] int days = AnalyticsService.DefaultWindowDays,
        CancellationToken cancellationToken = default) =>
        Ok(await _analytics.GetSummaryAsync(days, cancellationToken));

    [HttpGet("export")]
    [Produces("text/csv")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] int days = AnalyticsService.DefaultWindowDays,
        CancellationToken cancellationToken = default)
    {
        var csv = await _analytics.ExportCsvAsync(days, cancellationToken);
        var filename = $"analytics-{DateTime.UtcNow:yyyy-MM-dd}-{days}d.csv";

        return File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv", filename);
    }
}
