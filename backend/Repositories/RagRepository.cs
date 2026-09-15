using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories;

public class RagRepository : IRagRepository
{
    /// <summary>
    /// The channel workers LISTEN on. A constant shared with
    /// <c>rag/src/rag/queue.py</c> — if one side renames it, workers stop being woken and
    /// fall back to their poll interval, which is slow rather than broken. That is a
    /// deliberate property of the design: NOTIFY is an optimisation over polling, never
    /// the delivery mechanism.
    /// </summary>
    public const string QueueChannel = "rag_jobs";

    private readonly BlogDbContext _context;

    public RagRepository(BlogDbContext context)
    {
        _context = context;
    }

    public Task<LlmCredential?> GetCredentialAsync(
        int authorId,
        bool tracked = true,
        CancellationToken cancellationToken = default)
    {
        var query = tracked ? _context.LlmCredentials : _context.LlmCredentials.AsNoTracking();
        return query.FirstOrDefaultAsync(c => c.AuthorId == authorId, cancellationToken);
    }

    public async Task AddCredentialAsync(LlmCredential credential, CancellationToken cancellationToken = default) =>
        await _context.LlmCredentials.AddAsync(credential, cancellationToken);

    public void RemoveCredential(LlmCredential credential) =>
        _context.LlmCredentials.Remove(credential);

    public Task<RagIndexState?> GetIndexStateAsync(
        int authorId,
        bool tracked = false,
        CancellationToken cancellationToken = default)
    {
        var query = tracked ? _context.RagIndexStates : _context.RagIndexStates.AsNoTracking();
        return query.FirstOrDefaultAsync(s => s.AuthorId == authorId, cancellationToken);
    }

    // NOTE: loading the ORM objects with large vec into mem just to delete them is dumb
    public Task<int> DeleteDocumentsAsync(int authorId, CancellationToken cancellationToken = default) =>
        _context.RagDocuments
            .Where(d => d.AuthorId == authorId)
            .ExecuteDeleteAsync(cancellationToken);

    public async Task AddJobAsync(RagJob job, CancellationToken cancellationToken = default) =>
        await _context.RagJobs.AddAsync(job, cancellationToken);

    public Task NotifyQueueAsync(CancellationToken cancellationToken = default) =>
        // NOTE: no payload. A worker woken by this goes and claims whatever it can
        _context.Database.ExecuteSqlRawAsync($"NOTIFY {QueueChannel}", cancellationToken);

    public Task<RagJob?> GetJobAsync(Guid id, CancellationToken cancellationToken = default) =>
        _context.RagJobs
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

    public Task<RagJob?> GetActiveJobAsync(
        int authorId,
        RagJobKind kind,
        CancellationToken cancellationToken = default) =>
        _context.RagJobs
            .AsNoTracking()
            .Where(j => j.AuthorId == authorId &&
                        j.Kind == kind &&
                        (j.Status == RagJobStatus.Queued || j.Status == RagJobStatus.Running))
            .OrderByDescending(j => j.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<int> CountVisitorJobsSinceAsync(
        string visitorHash,
        DateTimeOffset since,
        CancellationToken cancellationToken = default) =>
        _context.RagJobs.CountAsync(
            j => j.VisitorHash == visitorHash &&
                 j.Kind == RagJobKind.JobFit &&
                 j.CreatedAt >= since &&
                 j.Status != RagJobStatus.Cancelled,
            cancellationToken);

    public Task<int> CountAccountJobsSinceAsync(
        int authorId,
        DateTimeOffset since,
        CancellationToken cancellationToken = default) =>
        _context.RagJobs.CountAsync(
            j => j.AuthorId == authorId &&
                 j.Kind == RagJobKind.JobFit &&
                 j.CreatedAt >= since &&
                 j.Status != RagJobStatus.Cancelled,
            cancellationToken);

    public async Task<decimal> SumSpendSinceAsync(
        int authorId,
        DateTimeOffset since,
        CancellationToken cancellationToken = default) =>
        await _context.RagJobs
            .Where(j => j.AuthorId == authorId && j.CreatedAt >= since)
            .SumAsync(j => (decimal?)j.CostUsd, cancellationToken) ?? 0m;

    public Task<int> CancelPendingJobsAsync(
        int authorId,
        DateTimeOffset now,
        CancellationToken cancellationToken = default) =>
        _context.RagJobs
            .Where(j => j.AuthorId == authorId &&
                        (j.Status == RagJobStatus.Queued || j.Status == RagJobStatus.Running))
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(j => j.Status, RagJobStatus.Cancelled)
                    .SetProperty(j => j.CompletedAt, now)
                    .SetProperty(j => j.Error, "The account's provider key was removed."),
                cancellationToken);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);
}
