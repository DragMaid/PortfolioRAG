using Backend.Models.Entities;

namespace Backend.Models.DTOs.Llm;

/// <summary>How well the portfolio answers the posting, in one word.</summary>
public enum JobFitVerdict
{
    /// <summary>Little in the portfolio speaks to what the posting asks for.</summary>
    Weak = 0,

    /// <summary>Some of it lands; the important requirements are unevidenced.</summary>
    Partial = 1,

    /// <summary>Most of what the posting asks for is evidenced.</summary>
    Promising = 2,

    /// <summary>Everything the posting treats as essential is evidenced.</summary>
    Strong = 3
}

/// <summary>Whether one requirement is answered by the portfolio.</summary>
public enum RequirementStatus
{
    Missing = 0,
    Partial = 1,
    Met = 2
}

/// <summary>The pipeline's answer, with every chunk attached to their original source.</summary>
public class JobFitReportDto
{
    public JobFitVerdict Verdict { get; init; }

    /// <summary>
    /// 0–100, computed from the requirement statuses rather than asked for directly: a
    /// model asked to grade itself out of a hundred will oblige, and the number will mean
    /// nothing. See <c>rag/src/rag/scoring.py</c>.
    /// </summary>
    public int Score { get; init; }

    public string Headline { get; init; } = string.Empty;

    public string Summary { get; init; } = string.Empty;

    /// <summary>Every requirement read out of the posting, in the order the posting raised them.</summary>
    public IReadOnlyList<RequirementAssessmentDto> Requirements { get; init; } =
        Array.Empty<RequirementAssessmentDto>();

    /// <summary>Where the portfolio is strongest against this posting.</summary>
    public IReadOnlyList<string> Strengths { get; init; } = Array.Empty<string>();

    /// TODO: I wanted to do this to show that there shouldn't be any lying on the
    /// platform, but isn't this kind of betraying the users?
    /// <summary>
    /// What the posting asks for that the portfolio does not evidence. Stated plainly: a
    /// gap the author can see is one they can write a post about.
    /// </summary>
    public IReadOnlyList<string> Gaps { get; init; } = Array.Empty<string>();

    /// <summary>What to raise in a first conversation, drawn from the matches above.</summary>
    public IReadOnlyList<string> TalkingPoints { get; init; } = Array.Empty<string>();

    public RetrievalTraceDto Retrieval { get; init; } = new();

    /// <summary>
    /// What the answer cost. Shown to the author, not to visitors — see
    /// <c>JobFitController</c>, which strips it on the public path.
    /// </summary>
    public UsageDto? Usage { get; init; }
}

/// <summary>One requirement from the posting, and what in the portfolio answers it.</summary>
public class RequirementAssessmentDto
{
    public string Requirement { get; init; } = string.Empty;

    /// <summary>
    /// Whether the posting treats it as essential. Only the essential ones move the score —
    /// a missing "nice to have" is not a gap.
    /// </summary>
    public bool IsEssential { get; init; }

    public RequirementStatus Status { get; init; }

    /// <summary>
    /// 0–1, the model's own certainty. Reported rather than acted on, except that a
    /// low-confidence "met" is rendered as a hedge.
    /// </summary>
    public double Confidence { get; init; }

    /// <summary>Why, in a sentence.</summary>
    public string Rationale { get; init; } = string.Empty;

    /// <summary>
    /// The passages this rests on. Empty is only legal for
    /// <see cref="RequirementStatus.Missing"/> — the pipeline demotes any other status that
    /// cannot name its evidence.
    /// </summary>
    public IReadOnlyList<EvidenceDto> Evidence { get; init; } = Array.Empty<EvidenceDto>();
}

/// <summary>One passage a judgement was drawn from.</summary>
public class EvidenceDto
{
    /// <summary>The <see cref="RagDocument"/> row, so a citation can be resolved and checked.</summary>
    public long DocumentId { get; init; }

    public RagSourceType SourceType { get; init; }

    /// <summary>"Vector Core", "Stripe — Staff Engineer". What the citation reads as.</summary>
    public string SourceLabel { get; init; } = string.Empty;

    /// <summary>
    /// The words relied on, quoted from the passage. Verified against the stored chunk
    /// before the report is returned, so a quote that was never written cannot be shown.
    /// </summary>
    public string Quote { get; init; } = string.Empty;
}

/// <summary>
/// What retrieval did, kept so a bad answer can be diagnosed as a retrieval problem or a
/// generation problem without re-running it.
/// </summary>
public class RetrievalTraceDto
{
    /// <summary>The searches the posting was decomposed into.</summary>
    public IReadOnlyList<string> Queries { get; init; } = Array.Empty<string>();

    public int PassagesConsidered { get; init; }

    /// <summary>How many of them the answer actually leaned on.</summary>
    public int PassagesCited { get; init; }

    /// <summary>
    /// Citations the model produced that named a passage it was not shown, or quoted words
    /// that are not in one. Dropped from the report; counted here, because a number that
    /// climbs is the signal that something upstream has regressed.
    /// </summary>
    public int CitationsRejected { get; init; }
}

/// <summary>What one analysis spent.</summary>
public class UsageDto
{
    public string Provider { get; init; } = string.Empty;

    public string Model { get; init; } = string.Empty;

    public int InputTokens { get; init; }

    public int OutputTokens { get; init; }

    public decimal CostUsd { get; init; }

    public int DurationMs { get; init; }
}
