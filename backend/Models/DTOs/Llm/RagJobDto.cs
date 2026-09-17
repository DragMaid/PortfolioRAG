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

    /// <summary>The letter, once a <see cref="RagJobKind.CoverLetter"/> job has succeeded.</summary>
    public CoverLetterDto? CoverLetter { get; init; }
}

/// <summary>
/// A job description to measure the portfolio against. The posting is the whole request:
/// the role and the company are read out of it, and come back on the report.
/// </summary>
public class JobFitRequestDto
{
    /// <summary>
    /// The posting, pasted whole. Plain text or Markdown — the pipeline reads the
    /// requirements, role and company out of it rather than expecting a particular shape.
    /// </summary>
    [Required]
    [StringLength(20000, MinimumLength = 120)]
    public string JobDescription { get; init; } = string.Empty;
}

/// <summary>A posting to write a cover letter for. The role and company are read out of it.</summary>
public class CoverLetterRequestDto
{
    [Required]
    [StringLength(20000, MinimumLength = 120)]
    public string JobDescription { get; init; } = string.Empty;

    /// <summary>Anything the author wants leaned on or left out — tone, a project to lead with.</summary>
    [StringLength(1000)]
    public string? Notes { get; init; }
}

/// <summary>A cover letter written from the portfolio, with the sources it drew on.</summary>
public class CoverLetterDto
{
    /// <summary>The letter, in Markdown.</summary>
    public string Letter { get; init; } = string.Empty;

    /// <summary>The role, as read out of the posting.</summary>
    public string RoleTitle { get; init; } = string.Empty;

    /// <summary>The hiring company, as read out of the posting. Null when it names none.</summary>
    public string? Company { get; init; }

    /// <summary>The passages the letter leans on, resolved to what they came from.</summary>
    public IReadOnlyList<CoverLetterSourceDto> Sources { get; init; } = Array.Empty<CoverLetterSourceDto>();

    public UsageDto? Usage { get; init; }
}

public class CoverLetterSourceDto
{
    public long DocumentId { get; init; }

    public RagSourceType SourceType { get; init; }

    public string SourceLabel { get; init; } = string.Empty;
}
