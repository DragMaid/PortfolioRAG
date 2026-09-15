using Backend.Common.Exceptions;
using Backend.Models.Entities;

namespace Backend.Services;

/// <summary>Finds the validator for a provider.</summary>
public interface ILlmProviderRegistry
{
    /// <summary>
    /// The validator for a provider, or a 400 when this deployment has none registered for
    /// it — which is what an author picking a vendor the build does not carry should get.
    /// </summary>
    ILlmProviderValidator For(LlmProvider provider);

    /// <summary>The providers this deployment can actually accept a key for.</summary>
    IReadOnlyList<LlmProvider> Supported { get; }
}

/// <summary>
/// A lookup over whatever <see cref="ILlmProviderValidator"/> implementations were
/// registered.
///
/// The whole of the "adaptable to any provider" story on this side: the API never names a
/// vendor outside <see cref="AnthropicProviderValidator"/>, so a second one is a class, a
/// line in Program.cs and a member on <see cref="LlmProvider"/>. The pipeline has the
/// matching seam in <c>rag/src/rag/providers</c>.
/// </summary>
public class LlmProviderRegistry : ILlmProviderRegistry
{
    private readonly IReadOnlyDictionary<LlmProvider, ILlmProviderValidator> _validators;

    public LlmProviderRegistry(IEnumerable<ILlmProviderValidator> validators)
    {
        // NOTE: last registration wins, so a deployment can substitute its own
        // implementation for a provider without having to unregister the built-in one.
        _validators = validators
            .GroupBy(validator => validator.Provider)
            .ToDictionary(group => group.Key, group => group.Last());
    }

    public IReadOnlyList<LlmProvider> Supported => _validators.Keys.ToList();

    public ILlmProviderValidator For(LlmProvider provider) =>
        _validators.TryGetValue(provider, out var validator)
            ? validator
            : throw new ValidationException($"This deployment cannot accept a {provider} key.");
}
