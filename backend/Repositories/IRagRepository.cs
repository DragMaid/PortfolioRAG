using Backend.Models.Entities;

namespace Backend.Repositories;

/// <summary>
/// Everything the API reads and writes on the retrieval side: the account's provider key,
/// the job queue, and the state of the index the worker maintains.
///
/// One repository rather than three because the three are read together on every screen
/// that shows any of them, and a credential without its month's spend is not a thing the
/// studio ever wants.
/// </summary>
public interface IRagRepository
{
    /* ---------------------------------------------------------------------- */
    /* Credential                                                             */
    /* ---------------------------------------------------------------------- */

    Task<LlmCredential?> GetCredentialAsync(
        int authorId,
        bool tracked = true,
        CancellationToken cancellationToken = default);

    Task AddCredentialAsync(LlmCredential credential, CancellationToken cancellationToken = default);

    void RemoveCredential(LlmCredential credential);

    /* ---------------------------------------------------------------------- */
    /* Index                                                                  */
    /* ---------------------------------------------------------------------- */

    Task<RagIndexState?> GetIndexStateAsync(
        int authorId,
        bool tracked = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Drops every indexed passage for an author. Called when the credential goes away:
    /// the chunks are derived from public content and hold no secret, but keeping an index
    /// nothing can query is how a system accumulates data nobody remembers consenting to.
    /// </summary>
    Task<int> DeleteDocumentsAsync(int authorId, CancellationToken cancellationToken = default);

    /// <summary>Every source the index tracks for an author, in the order the studio lists them.</summary>
    Task<IReadOnlyList<RagSource>> GetSourcesAsync(int authorId, CancellationToken cancellationToken = default);

    Task<RagSource?> GetSourceAsync(
        int authorId,
        RagSourceType sourceType,
        int sourceId,
        CancellationToken cancellationToken = default);

    Task AddSourceAsync(RagSource source, CancellationToken cancellationToken = default);

    Task<int> DeleteSourceAsync(
        int authorId,
        RagSourceType sourceType,
        int sourceId,
        CancellationToken cancellationToken = default);

    /// <summary>Forgets every tracked source for an author. Goes with the credential, as the passages do.</summary>
    Task<int> DeleteSourcesAsync(int authorId, CancellationToken cancellationToken = default);

    /// <summary>
    /// What the index should hold for an author right now: the profile, every job and every
    /// published post, with the label each is listed under. Read from the content tables, so
    /// a first build can list everything as queued before the worker has seen any of it.
    /// </summary>
    Task<IReadOnlyList<(RagSourceType Type, int Id, string Label)>> ListIndexableSourcesAsync(
        int authorId,
        CancellationToken cancellationToken = default);

    /* ---------------------------------------------------------------------- */
    /* Queue                                                                  */
    /* ---------------------------------------------------------------------- */

    Task AddJobAsync(RagJob job, CancellationToken cancellationToken = default);

    /// <summary>
    /// Wakes the workers listening on the queue channel. Separate from
    /// <see cref="SaveChangesAsync"/> and always called after it: a NOTIFY that outran its
    /// own INSERT wakes a worker that then finds nothing.
    /// </summary>
    Task NotifyQueueAsync(CancellationToken cancellationToken = default);

    Task<RagJob?> GetJobAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// The author's most recent job of a kind, if it has not finished. What stops a second
    /// rebuild being queued behind the first, and what the studio polls.
    /// </summary>
    Task<RagJob?> GetActiveJobAsync(
        int authorId,
        RagJobKind kind,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The author's newest job of a kind that no worker has claimed yet. A change can ride on
    /// that one; a job already running may have read the corpus before the change landed.
    /// </summary>
    Task<RagJob?> GetQueuedJobAsync(
        int authorId,
        RagJobKind kind,
        CancellationToken cancellationToken = default);

    /// <summary>How many analyses one visitor has asked for since a moment — the daily limit.</summary>
    Task<int> CountVisitorJobsSinceAsync(
        string visitorHash,
        DateTimeOffset since,
        CancellationToken cancellationToken = default);

    /// <summary>How many the account has served since a moment — the monthly limit.</summary>
    Task<int> CountAccountJobsSinceAsync(
        int authorId,
        DateTimeOffset since,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// What the account has spent since a moment — the monthly budget. Counts failed jobs
    /// too: tokens spent on an answer that was thrown away were still spent.
    /// </summary>
    Task<decimal> SumSpendSinceAsync(
        int authorId,
        DateTimeOffset since,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks every unfinished job of an author's cancelled. Called when the credential is
    /// removed, so queued work does not run against a key that is no longer offered.
    /// </summary>
    Task<int> CancelPendingJobsAsync(
        int authorId,
        DateTimeOffset now,
        CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
