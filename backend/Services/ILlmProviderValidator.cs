using Backend.Models.Entities;

namespace Backend.Services;

/// <summary>
/// What a provider said when we asked whether a key works.
/// </summary>
/// <param name="IsValid">The provider accepted the key.</param>
/// <param name="Error">
/// Why not, phrased for the person who just pasted it. Null when <paramref name="IsValid"/>.
/// </param>
/// <param name="Models">
/// The models the key may use, newest first. Empty when the provider would not say — the
/// studio then keeps whatever model the author had chosen rather than clearing the field.
/// </param>
/// <param name="IsProviderFault">
/// True when the key was never judged: a timeout, a 500, a network that would not resolve.
/// Kept apart from a rejected key because the two call for opposite responses — try again,
/// versus find a different key.
/// </param>
public readonly record struct LlmValidationResult(
    bool IsValid,
    string? Error,
    IReadOnlyList<string> Models,
    bool IsProviderFault)
{
    public static LlmValidationResult Valid(IReadOnlyList<string> models) =>
        new(true, null, models, false);

    public static LlmValidationResult Rejected(string error) =>
        new(false, error, Array.Empty<string>(), false);

    public static LlmValidationResult Unreachable(string error) =>
        new(false, error, Array.Empty<string>(), true);
}

/// <summary>
/// Asks one vendor whether a key is real, before anything is stored against it.
///
/// One implementation per <see cref="LlmProvider"/>; <see cref="Provider"/> is how the
/// registry picks. Adding a vendor is a class here and a member on the enum — the rest of
/// the API, and the whole of the pipeline, are written against the abstraction.
/// </summary>
public interface ILlmProviderValidator
{
    LlmProvider Provider { get; }

    /// <summary>The vendor's name as the studio shows it — "OpenAI", not "openai".</summary>
    string DisplayName { get; }

    /// <summary>
    /// What this provider's keys start with, for the key field's placeholder, so an author
    /// can tell at a glance they are pasting the right vendor's key.
    /// </summary>
    string KeyPlaceholder { get; }

    /// <summary>
    /// The model a key of this provider's gets when the author has not chosen one.
    /// </summary>
    string DefaultModel { get; }

    /// <summary>
    /// True for a string shaped like this provider's keys. A cheap local check so an
    /// obvious typo is caught without a round trip — never a substitute for the round trip.
    /// </summary>
    bool LooksLikeKey(string key);

    Task<LlmValidationResult> ValidateAsync(string apiKey, CancellationToken cancellationToken = default);
}
