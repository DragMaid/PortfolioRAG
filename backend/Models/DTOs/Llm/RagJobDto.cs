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

    /// TODO: if more jobs are added, should consider scaling this up using sealed DTOs inherited from Result DTO.
    /// <summary>The answer, once <see cref="Status"/> is <see cref="RagJobStatus.Succeeded"/>.</summary>
    public JobFitReportDto? Report { get; init; }

    /// <summary>The letter, once a <see cref="RagJobKind.CoverLetter"/> job has succeeded.</summary>
    public CoverLetterDto? CoverLetter { get; init; }

    /// <summary>The passages, once a <see cref="RagJobKind.Retrieval"/> job has succeeded.</summary>
    public RetrievalResultDto? Retrieval { get; init; }
}

/// <summary>
/// Searches to run against the account's own index.
///
/// One request rather than one per query: a posting is decomposed into a search per
/// requirement, and fusing the results of all of them is what the retrieval step is — run
/// separately they would be a dozen unfused lists, which is a different and worse search.
/// </summary>
public class RetrievalRequestDto
{
    /// <summary>
    /// What to search for, written as the evidence would read rather than as the posting
    /// phrased it. At most <see cref="MaximumQueries"/>, which is comfortably more than a
    /// long posting produces.
    /// </summary>
    [Required]
    [MinLength(1, ErrorMessage = "Give at least one search to run.")]
    [MaxLength(MaximumQueries, ErrorMessage = "That is more searches than one posting needs.")]
    public IReadOnlyList<string> Queries { get; init; } = Array.Empty<string>();

    public const int MaximumQueries = 24;

    /// <summary>Long enough for a sentence-shaped search, short enough not to be a payload.</summary>
    public const int MaximumQueryChars = 300;
}

/// <summary>What a search over the index turned up.</summary>
public class RetrievalResultDto
{
    /// <summary>
    /// The portfolio's owner. Carried here because a cover letter is signed, and a caller
    /// running that stage elsewhere has no other way to know the name.
    /// </summary>
    public string AuthorName { get; init; } = string.Empty;

    /// <summary>The searches as they were run, echoed back for the report's trace.</summary>
    public IReadOnlyList<string> Queries { get; init; } = Array.Empty<string>();

    public IReadOnlyList<RetrievedPassageDto> Passages { get; init; } =
        Array.Empty<RetrievedPassageDto>();
}

/// <summary>One passage, as the reasoning half of the pipeline needs it.</summary>
public class RetrievedPassageDto
{
    /// <summary>The <see cref="RagDocument"/> row. This is the <c>[#N]</c> a model cites.</summary>
    public long DocumentId { get; init; }

    public RagSourceType SourceType { get; init; }

    public string SourceLabel { get; init; } = string.Empty;

    /// <summary>Which chunk of its source this is, in order.</summary>
    public int ChunkIndex { get; init; }

    public string Content { get; init; } = string.Empty;

    /// <summary>The fused rank score. Reported for diagnosis, not acted on.</summary>
    public double Score { get; init; }

    /// <summary>Which of the submitted searches found it.</summary>
    public IReadOnlyList<string> MatchedQueries { get; init; } = Array.Empty<string>();
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
