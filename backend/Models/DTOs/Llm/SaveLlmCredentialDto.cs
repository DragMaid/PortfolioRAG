using System.ComponentModel.DataAnnotations;
using Backend.Models.Entities;

namespace Backend.Models.DTOs.Llm;

/// <summary>
/// A key being entered or replaced. There is no "update the key" — a new one always
/// supersedes, because the API cannot read the old one back to diff against it.
/// </summary>
public class SaveLlmCredentialDto
{
    /// <summary>
    /// Which vendor the key belongs to. Required rather than defaulted: a key checked
    /// against the wrong vendor fails with a misleading "rejected", so the author says which
    /// one it is. <c>GET /api/llm/providers</c> lists the choices.
    /// </summary>
    [Required]
    public LlmProvider? Provider { get; init; }

    /// <summary>
    /// The raw provider key. The only request in this API that carries one, and the only
    /// copy that will exist outside the sealed column.
    /// </summary>
    [Required]
    [StringLength(400, MinimumLength = 8)]
    public string ApiKey { get; init; } = string.Empty;

    /// <summary>
    /// Which model to use. Null takes the provider's default — so entering a key is one
    /// field, and choosing a model is a decision that can wait.
    /// </summary>
    [StringLength(120)]
    public string? Model { get; init; }
}

/// <summary>
/// The dials around a key that is already stored. Separate from
/// <see cref="SaveLlmCredentialDto"/> so that changing a limit does not require re-entering
/// a secret the author no longer has a copy of.
/// </summary>
public class UpdateLlmSettingsDto
{
    /// <summary>Whether visitors see the button at all. The consent, kept apart from the key.</summary>
    public bool IsPublicFitEnabled { get; init; }

    [Range(1, 1000)]
    public int DailyVisitorLimit { get; init; } = LlmCredential.DefaultDailyVisitorLimit;

    [Range(1, 100000)]
    public int MonthlyAccountLimit { get; init; } = LlmCredential.DefaultMonthlyAccountLimit;

    [Range(0, 10000)]
    public decimal MonthlyBudgetUsd { get; init; } = LlmCredential.DefaultMonthlyBudgetUsd;

    /// <summary>
    /// The model to run. Validated against what the provider said the key may use, when
    /// the provider said anything.
    /// </summary>
    [StringLength(120)]
    public string? Model { get; init; }
}
