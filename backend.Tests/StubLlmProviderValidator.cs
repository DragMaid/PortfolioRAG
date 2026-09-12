using Backend.Models.Entities;
using Backend.Services;

namespace Backend.Tests;

/// <summary>
/// Stands in for a vendor, so the three answers a validation can give are all reachable.
///
/// A real key can only ever say "yes"; the interesting cases are a key the provider
/// refuses and a provider that cannot be reached at all, and those lead to opposite
/// behaviour — one replaces nothing and records a rejection, the other replaces nothing and
/// records nothing.
/// </summary>
public sealed class StubLlmProviderValidator : ILlmProviderValidator
{
    public LlmProvider Provider { get; set; } = LlmProvider.Anthropic;

    public string DefaultModel { get; set; } = "claude-opus-5";

    /// <summary>What the next call answers. Defaults to accepting.</summary>
    public LlmValidationResult NextResult { get; set; } =
        LlmValidationResult.Valid(["claude-opus-5", "claude-sonnet-5"]);

    /// <summary>Keys seen, so a test can assert the raw key reached the provider exactly once.</summary>
    public List<string> Validated { get; } = [];

    public bool LooksLikeKey(string key) => key.StartsWith("sk-ant-", StringComparison.Ordinal);

    public Task<LlmValidationResult> ValidateAsync(
        string apiKey,
        CancellationToken cancellationToken = default)
    {
        Validated.Add(apiKey);
        return Task.FromResult(NextResult);
    }

    public void Reject(string message = "That key was refused.") =>
        NextResult = LlmValidationResult.Rejected(message);

    public void GoOffline(string message = "The provider could not be reached.") =>
        NextResult = LlmValidationResult.Unreachable(message);

    public void Accept(params string[] models) =>
        NextResult = LlmValidationResult.Valid(models.Length > 0 ? models : ["claude-opus-5"]);
}
