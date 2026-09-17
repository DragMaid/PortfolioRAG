using Backend.Common.Security;
using Backend.Models.DTOs.Llm;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// The account's own provider key, the ceilings around it, and the retrieval index it
/// pays for.
///
/// Split in two by <c>[SessionOnly]</c>. Everything that touches the credential itself is
/// session-only for the same reason the token cabinet is: this is a billable credential,
/// and a leaked API token that could read or replace it would be a loss without a bound.
/// Unlike the token cabinet the key can never be read back at all, by anything — see
/// <see cref="Backend.Common.Security.SecretProtector"/>.
///
/// Running a job is not in that class. It cannot read, replace or remove the key, and what
/// it can spend is already bounded by the account's monthly ceilings, so the three run
/// endpoints below accept an API token with the write scope. That is what lets a script —
/// or <c>tools/cover-letter</c> — drive the pipeline without a studio sign-in.
/// </summary>
[ApiController]
[Route("api/llm")]
[Produces("application/json")]
[Authorize]
public class LlmController : ControllerBase
{
    private readonly ILlmCredentialService _credentials;

    public LlmController(ILlmCredentialService credentials)
    {
        _credentials = credentials;
    }

    /// <summary>
    /// The providers this deployment can accept a key for, with each one's default model and
    /// what its keys look like. The choices for <c>PUT credential</c>'s <c>provider</c>.
    /// </summary>
    [HttpGet("providers")]
    [SessionOnly]
    [ProducesResponseType(typeof(IReadOnlyList<LlmProviderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public ActionResult<IReadOnlyList<LlmProviderDto>> GetProviders() =>
        Ok(_credentials.GetProviders());

    /// <summary>
    /// The key on this account with its month to date and its index, or 204 when none has
    /// been added.
    /// </summary>
    [HttpGet("credential")]
    [SessionOnly]
    [ProducesResponseType(typeof(LlmCredentialDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<LlmCredentialDto>> GetCredential(CancellationToken cancellationToken)
    {
        var credential = await _credentials.GetAsync(cancellationToken);
        // NOTE: 204 rather than 404 if user havent added the credentials, to avoid
        // errors popping up and confusing the users if a 404 code were to be sent
        return credential is null ? NoContent() : Ok(credential);
    }

    /// <summary>
    /// Stores a provider key, replacing whatever was there. The key is checked with the
    /// provider first and is not stored at all if they reject it.
    /// </summary>
    [HttpPut("credential")]
    [SessionOnly]
    [ProducesResponseType(typeof(LlmCredentialDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<LlmCredentialDto>> SaveCredential(
        [FromBody] SaveLlmCredentialDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _credentials.SaveAsync(dto, cancellationToken));

    /// <summary>Asks the provider whether the stored key still works.</summary>
    [HttpPost("credential/validate")]
    [SessionOnly]
    [ProducesResponseType(typeof(LlmCredentialDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<LlmCredentialDto>> Revalidate(CancellationToken cancellationToken) =>
        Ok(await _credentials.RevalidateAsync(cancellationToken));

    /// <summary>Changes the model, the limits, and whether visitors see the button.</summary>
    [HttpPatch("credential")]
    [SessionOnly]
    [ProducesResponseType(typeof(LlmCredentialDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LlmCredentialDto>> UpdateSettings(
        [FromBody] UpdateLlmSettingsDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _credentials.UpdateSettingsAsync(dto, cancellationToken));

    /// <summary>
    /// Forgets the key, cancels queued work and drops the index. Succeeds even if there was
    /// nothing to forget.
    /// </summary>
    [HttpDelete("credential")]
    [SessionOnly]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteCredential(CancellationToken cancellationToken)
    {
        await _credentials.DeleteAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Runs an analysis against your own portfolio — what a visitor would see. Counts
    /// against the monthly budget.
    /// </summary>
    [HttpPost("job-fit")]
    [ProducesResponseType(typeof(RagJobDto), StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<ActionResult<RagJobDto>> TryJobFit(
        [FromBody] JobFitRequestDto dto,
        CancellationToken cancellationToken)
    {
        var job = await _credentials.TryJobFitAsync(dto, cancellationToken);
        return Accepted($"/api/llm/jobs/{job.Id}", job);
    }

    /// <summary>
    /// Writes a cover letter for a posting from your own portfolio. Poll the returned job for
    /// the letter. Counts against the monthly budget.
    /// </summary>
    [HttpPost("cover-letter")]
    [ProducesResponseType(typeof(RagJobDto), StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<ActionResult<RagJobDto>> WriteCoverLetter(
        [FromBody] CoverLetterRequestDto dto,
        CancellationToken cancellationToken)
    {
        var job = await _credentials.WriteCoverLetterAsync(dto, cancellationToken);
        return Accepted($"/api/llm/jobs/{job.Id}", job);
    }

    /// <summary>
    /// One of your jobs, with what it cost. The public endpoint serves the same job without
    /// the cost — see <c>JobFitController</c>.
    /// </summary>
    [HttpGet("jobs/{id:guid}")]
    [ProducesResponseType(typeof(RagJobDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RagJobDto>> GetJob(Guid id, CancellationToken cancellationToken) =>
        Ok(await _credentials.GetOwnJobAsync(id, cancellationToken));
}
