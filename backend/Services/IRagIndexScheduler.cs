using Backend.Models.Entities;

namespace Backend.Services;

/// <summary>
/// Keeps the retrieval index following the portfolio without anybody asking it to.
///
/// The content services call this after every change that alters what the index should
/// hold. Each call marks the source queued, so the studio shows it at once, and makes sure a
/// rebuild is waiting on the queue. Nothing happens for an account with no provider key: an
/// index nothing can query is not kept.
/// </summary>
public interface IRagIndexScheduler
{
    /// <summary>A source's text changed, or it became indexable (a post was published).</summary>
    Task SourceChangedAsync(
        int authorId,
        RagSourceType sourceType,
        int sourceId,
        string label,
        CancellationToken cancellationToken = default);

    /// <summary>A source left the corpus (unpublished or deleted). Its passages go on the next run.</summary>
    Task SourceRemovedAsync(
        int authorId,
        RagSourceType sourceType,
        int sourceId,
        CancellationToken cancellationToken = default);

    /// <summary>Queues every indexable source. Used when a key is first stored.</summary>
    Task ScheduleAllAsync(int authorId, CancellationToken cancellationToken = default);
}
