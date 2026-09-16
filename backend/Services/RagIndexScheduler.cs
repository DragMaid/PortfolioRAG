using System.Text.Json;
using Backend.Mapping;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services;

public class RagIndexScheduler : IRagIndexScheduler
{
    private readonly IRagRepository _rag;
    private readonly TimeProvider _timeProvider;

    public RagIndexScheduler(IRagRepository rag, TimeProvider timeProvider)
    {
        _rag = rag;
        _timeProvider = timeProvider;
    }

    public async Task SourceChangedAsync(
        int authorId,
        RagSourceType sourceType,
        int sourceId,
        string label,
        CancellationToken cancellationToken = default)
    {
        if (await _rag.GetCredentialAsync(authorId, tracked: false, cancellationToken) is null)
            return;

        var now = _timeProvider.GetUtcNow();
        await MarkQueuedAsync(authorId, sourceType, sourceId, label, now, cancellationToken);
        await _rag.SaveChangesAsync(cancellationToken);
        await EnqueueAsync(authorId, now, cancellationToken);
    }

    public async Task SourceRemovedAsync(
        int authorId,
        RagSourceType sourceType,
        int sourceId,
        CancellationToken cancellationToken = default)
    {
        if (await _rag.GetCredentialAsync(authorId, tracked: false, cancellationToken) is null)
            return;

        // NOTE: the row goes now rather than showing a "removing" state nobody asked for.
        // Its passages stay retrievable until the queued run deletes them, seconds later.
        await _rag.DeleteSourceAsync(authorId, sourceType, sourceId, cancellationToken);
        await EnqueueAsync(authorId, _timeProvider.GetUtcNow(), cancellationToken);
    }

    public async Task ScheduleAllAsync(int authorId, CancellationToken cancellationToken = default)
    {
        var now = _timeProvider.GetUtcNow();

        foreach (var (type, id, label) in await _rag.ListIndexableSourcesAsync(authorId, cancellationToken))
            await MarkQueuedAsync(authorId, type, id, label, now, cancellationToken);

        await _rag.SaveChangesAsync(cancellationToken);
        await EnqueueAsync(authorId, now, cancellationToken);
    }

    private async Task MarkQueuedAsync(
        int authorId,
        RagSourceType sourceType,
        int sourceId,
        string label,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var source = await _rag.GetSourceAsync(authorId, sourceType, sourceId, cancellationToken);

        if (source is null)
        {
            source = new RagSource { AuthorId = authorId, SourceType = sourceType, SourceId = sourceId };
            await _rag.AddSourceAsync(source, cancellationToken);
        }

        source.Label = label.Length > 300 ? label[..300] : label;
        source.Status = RagSourceStatus.Queued;
        source.Error = null;
        source.QueuedAt = now;
    }

    /// <summary>
    /// Makes sure an unclaimed rebuild is waiting. A running one does not count: it may have
    /// read the corpus before this change was committed.
    /// </summary>
    private async Task EnqueueAsync(int authorId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (await _rag.GetQueuedJobAsync(authorId, RagJobKind.Index, cancellationToken) is not null)
            return;

        await _rag.AddJobAsync(new RagJob
        {
            Id = Guid.NewGuid(),
            AuthorId = authorId,
            Kind = RagJobKind.Index,
            Status = RagJobStatus.Queued,
            PayloadJson = JsonSerializer.Serialize(new { force = false }, LlmMappingExtensions.WorkerJson),
            AvailableAt = now,
            CreatedAt = now
        }, cancellationToken);

        await _rag.SaveChangesAsync(cancellationToken);
        await _rag.NotifyQueueAsync(cancellationToken);
    }
}
