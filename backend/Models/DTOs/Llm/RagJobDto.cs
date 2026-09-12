using System.ComponentModel.DataAnnotations;
using Backend.Models.Entities;

namespace Backend.Models.DTOs.Llm;

/// <summary>
/// A queued piece of work, as whoever is waiting on it sees it.
///
/// Handed to anonymous callers, so it carries nothing about the account beyond what they
/// asked for: no author id, no token counts, no cost. Those live on the row and are
/// reported to the studio through <see cref="LlmCredentialDto"/>.
/// </summary>
public class RagJobDto
{
    public Guid Id { get; init; }

    public RagJobKind Kind { get; init; }

    public RagJobStatus Status { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? CompletedAt { get; init; }

    /// <summary>
    /// Why it failed, in words meant for the reader. Null unless
    /// <see cref="Status"/> is <see cref="RagJobStatus.Failed"/>.
    /// </summary>
    public string? Error { get; init; }

    /// <summary>
    /// Roughly how long this kind of job takes, so a client can show honest progress rather
    /// than a spinner with no end. An estimate, not a promise. Learnt this from the UX shit online
    /// </summary>
    public int EstimatedSeconds { get; init; }

    /// <summary>The answer, once <see cref="Status"/> is <see cref="RagJobStatus.Succeeded"/>.</summary>
    public JobFitReportDto? Report { get; init; }
}

/// <summary>A job description to measure the portfolio against.</summary>
public class JobFitRequestDto
{
    /// <summary>
    /// The posting, pasted whole. Plain text or Markdown — the pipeline reads the
    /// requirements out of it rather than expecting a particular shape.
    /// </summary>
    [Required]
    [StringLength(20000, MinimumLength = 120)]
    public string JobDescription { get; init; } = string.Empty;

    /// <summary>The role, when the paste did not include a title line.</summary>
    [StringLength(200)]
    public string? RoleTitle { get; init; }

    [StringLength(200)]
    public string? Company { get; init; }
}
