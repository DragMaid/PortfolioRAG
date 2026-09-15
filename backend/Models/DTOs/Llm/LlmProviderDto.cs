using Backend.Models.Entities;

namespace Backend.Models.DTOs.Llm;

/// <summary>
/// A provider this deployment can accept a key for, so the studio offers exactly those
/// rather than guessing from the enum.
/// </summary>
public class LlmProviderDto
{
    public LlmProvider Provider { get; init; }

    /// <summary>"Google Gemini" — the vendor as a person would name it.</summary>
    public string DisplayName { get; init; } = string.Empty;

    /// <summary>The model a new key gets when none is chosen.</summary>
    public string DefaultModel { get; init; } = string.Empty;

    /// <summary>What the provider's keys look like, for the key field's placeholder.</summary>
    public string KeyPlaceholder { get; init; } = string.Empty;
}
