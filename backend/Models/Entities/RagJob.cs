namespace Backend.Models.Entities;

/// <summary>What a queued job asks the Python worker to do.</summary>
public enum RagJobKind
{
    /// <summary>Re-chunk and re-embed the author's corpus.</summary>
    Index = 0,

    /// <summary>Compare a pasted job description against that corpus.</summary>
    JobFit = 1,

    /// <summary>Write a cover letter for a pasted job description, grounded in that corpus.</summary>
    CoverLetter = 2
}

public enum RagJobStatus
{
    /// <summary>Waiting for a worker. The only state a row is created in.</summary>
    Queued = 0,

    /// <summary>Claimed by a worker, which holds it until it finishes or its lease lapses.</summary>
    Running = 1,

    Succeeded = 2,

    /// <summary>Out of attempts. <see cref="RagJob.Error"/> says why the last one failed.</summary>
    Failed = 3,

    /// <summary>Abandoned before it ran — the credential was removed, or the account was.</summary>
    Cancelled = 4
}

/// <summary>
/// One unit of work on the queue between the API and the Python worker.
/// Rows are kept after they finish. They are how the studio shows what the month cost and
/// how the rate limiter counts what a visitor has already asked for.
/// </summary>
public class RagJob
{
    public Guid Id { get; set; }

    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    public RagJobKind Kind { get; set; }

    public RagJobStatus Status { get; set; }

    /// <summary>The arguments, as JSON. Shapes live in <c>rag/src/rag/schemas.py</c>.</summary>
    public string PayloadJson { get; set; } = "{}";

    /// <summary>The answer, as JSON, once there is one.</summary>
    public string? ResultJson { get; set; }

    /// <summary>
    /// Why the last attempt failed. Written on every failed attempt, not only the final
    /// one, so a job that eventually succeeded still shows what it struggled with.
    /// </summary>
    public string? Error { get; set; }

    public int Attempts { get; set; }

    public int MaxAttempts { get; set; } = DefaultMaxAttempts;

    /// <summary>Which worker holds the lease, for the log and for recovering a crashed one.</summary>
    public string? LockedBy { get; set; }

    public DateTimeOffset? LockedAt { get; set; }

    public DateTimeOffset AvailableAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>
    /// Who asked? for a public request: the same salted daily hash analytics uses, so the
    /// per-visitor limit can be counted without storing an address. Null for work the
    /// signed-in author started.
    /// </summary>
    public string? VisitorHash { get; set; }

    public int InputTokens { get; set; }

    public int OutputTokens { get; set; }

    /// <summary>
    /// What the provider charged, priced by the worker from its own model table. The
    /// monthly budget is the sum of this column, so a job that failed after spending
    /// tokens still counts — the bill does not care that the answer was thrown away.
    /// </summary>
    public decimal CostUsd { get; set; }

    public const int DefaultMaxAttempts = 3;

    /// <summary>
    /// How long a worker's claim is good for. A worker that dies mid-job leaves a Running
    /// row behind; after this it is fair game again, which is the only thing standing
    /// between a crash and a job that is never finished and never retried.
    /// </summary>
    public static readonly TimeSpan LeaseDuration = TimeSpan.FromMinutes(10);

    public bool IsTerminal =>
        Status is RagJobStatus.Succeeded or RagJobStatus.Failed or RagJobStatus.Cancelled;
}
