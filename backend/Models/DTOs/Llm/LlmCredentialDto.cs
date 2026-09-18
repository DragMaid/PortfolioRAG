using Backend.Models.Entities;

namespace Backend.Models.DTOs.Llm;

/// <summary>
/// The account's provider key as the studio shows it — which is to say, everything about it
/// except the key.
/// </summary>
public class LlmCredentialDto
{
    public LlmProvider Provider { get; init; }

    /// <summary>"sk-ant-…4f2a". Enough to tell two keys apart, never enough to use one.</summary>
    public string KeyPreview { get; init; } = string.Empty;

    public string Model { get; init; } = string.Empty;

    public DateTimeOffset? ValidatedAt { get; init; }

    /// <summary>What the provider said the last time a check failed, or null.</summary>
    public string? ValidationError { get; init; }

    /// <summary>True when the pipeline may run at all. False leaves the studio in a "fix this" state.</summary>
    public bool IsUsable { get; init; }

    public bool IsPublicFitEnabled { get; init; }

    public int DailyVisitorLimit { get; init; }

    public int MonthlyAccountLimit { get; init; }

    public decimal MonthlyBudgetUsd { get; init; }

    /// <summary>Analyses served so far this calendar month, against <see cref="MonthlyAccountLimit"/>.</summary>
    public int MonthlyRequestCount { get; init; }

    /// <summary>Spent so far this calendar month, against <see cref="MonthlyBudgetUsd"/>.</summary>
    public decimal MonthlySpendUsd { get; init; }

    public DateTimeOffset UpdatedAt { get; init; }

    /// <summary>
    /// The models this key may use, as the provider listed them at the last successful
    /// check. Empty when it has never been checked or the provider would not say.
    /// </summary>
    public IReadOnlyList<string> AvailableModels { get; init; } = Array.Empty<string>();

    /// <summary>What the last index run over the portfolio produced.</summary>
    public RagIndexStateDto Index { get; init; } = new();
}

/// <summary>The state of the retrieval index behind the answers.</summary>
public class RagIndexStateDto
{
    public DateTimeOffset? BuiltAt { get; init; }

    /// <summary>Passages currently retrievable. Zero means every answer would be ungrounded.</summary>
    public int DocumentCount { get; init; }

    public string? Error { get; init; }

    /// <summary>
    /// Every post, job and profile the index tracks, with where each stands. Kept current by
    /// the server as content changes; there is nothing for the author to trigger.
    /// </summary>
    public IReadOnlyList<RagSourceDto> Sources { get; init; } = Array.Empty<RagSourceDto>();
}

/// <summary>One row of the studio's index table.</summary>
public class RagSourceDto
{
    public RagSourceType SourceType { get; init; }

    public int SourceId { get; init; }

    public string Label { get; init; } = string.Empty;

    public RagSourceStatus Status { get; init; }

    /// <summary>Why it failed, when <see cref="Status"/> is <see cref="RagSourceStatus.Failed"/>.</summary>
    public string? Error { get; init; }

    public int PassageCount { get; init; }

    public DateTimeOffset QueuedAt { get; init; }

    public DateTimeOffset? IndexedAt { get; init; }
}
