using Backend.Models.DTOs.Llm;

namespace Backend.Services;

/// <summary>
/// The signed-in author's own provider key and the settings around it.
///
/// Every method here acts on the caller's account, taken from the access token. There is no
/// overload that takes an author id, for the same reason the token cabinet has none.
/// </summary>
public interface ILlmCredentialService
{
    /// <summary>
    /// The account's credential, its month to date and its index, or null when no key has
    /// been supplied.
    /// </summary>
    Task<LlmCredentialDto?> GetAsync(CancellationToken cancellationToken = default);

    /// <summary>The providers a key can be saved for, in the order the studio offers them.</summary>
    IReadOnlyList<LlmProviderDto> GetProviders();

    /// <summary>
    /// Checks a key with the provider and stores it if it works, replacing whatever was
    /// there. A key the provider rejects is not stored at all.
    /// </summary>
    Task<LlmCredentialDto> SaveAsync(SaveLlmCredentialDto dto, CancellationToken cancellationToken = default);

    /// <summary>Re-checks the stored key with the provider without it being re-entered.</summary>
    Task<LlmCredentialDto> RevalidateAsync(CancellationToken cancellationToken = default);

    /// <summary>Changes the model, the ceilings, and whether the public button is shown.</summary>
    Task<LlmCredentialDto> UpdateSettingsAsync(
        UpdateLlmSettingsDto dto,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Forgets the key, cancels whatever was queued against it, and drops the index it
    /// built. Idempotent.
    /// </summary>
    Task DeleteAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// One of the caller's own jobs, with what it cost. Scoped to the account, so a job id
    /// belonging to somebody else reads as not found rather than as somebody else's answer.
    /// </summary>
    Task<RagJobDto> GetOwnJobAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Runs the pipeline against the caller's own portfolio — the studio's way of seeing
    /// what a visitor would get. Counts against the budget; not against the daily
    /// per-visitor limit, which exists to bound strangers rather than the owner.
    /// </summary>
    Task<RagJobDto> TryJobFitAsync(JobFitRequestDto dto, CancellationToken cancellationToken = default);

    /// <summary>
    /// Queues a cover letter for a posting, written from the caller's own indexed portfolio.
    /// Studio-only — there is no public path to this — and counts against the budget.
    /// </summary>
    Task<RagJobDto> WriteCoverLetterAsync(CoverLetterRequestDto dto, CancellationToken cancellationToken = default);
}
