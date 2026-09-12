using Backend.Models.DTOs.Llm;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// The public job-fit check: a visitor measuring a posting against somebody's portfolio.
///
/// Every endpoint here is anonymous and every one of them spends the portfolio owner's
/// money, which is why the ceilings live in the service rather than in a filter — they are
/// part of what the endpoint means, not a cross-cutting concern bolted beside it.
/// </summary>
[ApiController]
[Route("api")]
[Produces("application/json")]
[AllowAnonymous]
public class JobFitController : ControllerBase
{
    private readonly IJobFitService _jobFit;

    public JobFitController(IJobFitService jobFit)
    {
        _jobFit = jobFit;
    }

    /// <summary>
    /// Whether this portfolio offers the check, and how many runs the caller has left
    /// today. Answers for a handle that does not exist too, identically.
    /// </summary>
    [HttpGet("authors/handle/{handle}/job-fit")]
    [ProducesResponseType(typeof(JobFitAvailabilityDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<JobFitAvailabilityDto>> GetAvailability(
        string handle,
        CancellationToken cancellationToken) =>
        Ok(await _jobFit.GetAvailabilityAsync(handle, cancellationToken));

    /// <summary>
    /// Queues an analysis of a posting against this portfolio. Returns the job to poll —
    /// the pipeline takes tens of seconds, which is longer than a request should be held.
    /// </summary>
    [HttpPost("authors/handle/{handle}/job-fit")]
    [ProducesResponseType(typeof(RagJobDto), StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<ActionResult<RagJobDto>> Submit(
        string handle,
        [FromBody] JobFitRequestDto dto,
        CancellationToken cancellationToken)
    {
        var job = await _jobFit.SubmitAsync(handle, dto, cancellationToken);
        return Accepted($"/api/job-fit/{job.Id}", job);
    }

    /// <summary>
    /// One analysis, by the id the submission returned. Anonymous: the id is a GUID nobody
    /// else is given, and holding it is what stands in for a session.
    /// </summary>
    [HttpGet("job-fit/{id:guid}")]
    [ProducesResponseType(typeof(RagJobDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RagJobDto>> GetJob(Guid id, CancellationToken cancellationToken) =>
        Ok(await _jobFit.GetJobAsync(id, cancellationToken));
}
