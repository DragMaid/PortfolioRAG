using System.Net;
using System.Text.Json;
using Backend.Common.Options;
using Backend.Models.Entities;
using Microsoft.Extensions.Options;

namespace Backend.Services;

/// <summary>
/// Confirms a Gemini API key by listing the models it may use — free, and only refused for
/// a bad key. See <see cref="AnthropicProviderValidator"/> for why that beats a trial completion.
/// </summary>
public class GeminiProviderValidator : ILlmProviderValidator
{
    private readonly HttpClient _http;
    private readonly LlmOptions _options;
    private readonly ILogger<GeminiProviderValidator> _logger;

    public GeminiProviderValidator(
        HttpClient http,
        IOptions<LlmOptions> options,
        ILogger<GeminiProviderValidator> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public LlmProvider Provider => LlmProvider.Gemini;

    public string DisplayName => "Google Gemini";

    public string KeyPlaceholder => "AIza...";

    public string DefaultModel => _options.GeminiDefaultModel;

    // NOTE: Google API keys start "AIza" and are 39 characters today; the length is checked
    // as a floor for the same reason the Anthropic check is.
    public bool LooksLikeKey(string key) => key.Length >= 30;

    public async Task<LlmValidationResult> ValidateAsync(
        string apiKey,
        CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{_options.GeminiBaseUrl.TrimEnd('/')}/v1beta/models");

        // NOTE: in a header rather than the ?key= query string, so it stays out of any log
        // that records URLs
        request.Headers.Add("x-goog-api-key", apiKey);

        HttpResponseMessage response;

        try
        {
            response = await _http.SendAsync(request, cancellationToken);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return LlmValidationResult.Unreachable(
                $"Google did not answer within {_options.ValidationTimeoutSeconds} seconds. " +
                "Your key has not been changed — try again in a moment.");
        }
        catch (HttpRequestException exception)
        {
            _logger.LogWarning(exception, "Could not reach the Gemini API to validate a key.");
            return LlmValidationResult.Unreachable(
                "Could not reach Google. Your key has not been changed — try again in a moment.");
        }

        using (response)
        {
            if (response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                return LlmValidationResult.Valid(ReadModelIds(body));
            }

            return response.StatusCode switch
            {
                // NOTE: Google answers an invalid key with 400 API_KEY_INVALID rather than a
                // 401, so 400 counts as a rejection here too.
                HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                    LlmValidationResult.Rejected(
                        "Google rejected that key. Check you copied all of it, that it has not been " +
                        "revoked, and that the Gemini API is enabled for its project."),

                HttpStatusCode.TooManyRequests =>
                    LlmValidationResult.Unreachable(
                        "Google is rate limiting this key right now, so it could not be checked. Try again shortly."),

                >= HttpStatusCode.InternalServerError =>
                    LlmValidationResult.Unreachable(
                        "Google returned an error, so the key could not be checked. Try again shortly."),

                _ => LlmValidationResult.Rejected(
                    $"Google refused the check ({(int)response.StatusCode}). The key may be malformed.")
            };
        }
    }

    /// <summary>
    /// The Gemini models that can generate content, without the "models/" prefix the API
    /// puts on every id — the pipeline and the stored credential use the bare id.
    /// </summary>
    private IReadOnlyList<string> ReadModelIds(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);

            if (!document.RootElement.TryGetProperty("models", out var models) ||
                models.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<string>();
            }

            return models
                .EnumerateArray()
                .Where(SupportsGenerateContent)
                .Select(entry => entry.TryGetProperty("name", out var name) ? name.GetString() : null)
                .Where(name => !string.IsNullOrWhiteSpace(name) &&
                               name.StartsWith("models/gemini-", StringComparison.Ordinal))
                .Select(name => name!["models/".Length..])
                .ToList();
        }
        catch (JsonException exception)
        {
            _logger.LogWarning(exception, "The Gemini models response could not be parsed.");
            return Array.Empty<string>();
        }
    }

    private static bool SupportsGenerateContent(JsonElement entry) =>
        entry.TryGetProperty("supportedGenerationMethods", out var methods) &&
        methods.ValueKind == JsonValueKind.Array &&
        methods.EnumerateArray().Any(method => method.GetString() == "generateContent");
}
