using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Backend.Common.Options;
using Backend.Models.Entities;
using Microsoft.Extensions.Options;

namespace Backend.Services;

/// <summary>
/// Confirms a Groq key by listing the models it may use — free, and only refused for a bad
/// key. See <see cref="AnthropicProviderValidator"/> for why that beats a trial completion.
/// </summary>
public class GroqProviderValidator : ILlmProviderValidator
{
    private readonly HttpClient _http;
    private readonly LlmOptions _options;
    private readonly ILogger<GroqProviderValidator> _logger;

    public GroqProviderValidator(
        HttpClient http,
        IOptions<LlmOptions> options,
        ILogger<GroqProviderValidator> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public LlmProvider Provider => LlmProvider.Groq;

    public string DisplayName => "Groq";

    public string KeyPlaceholder => "gsk_...";

    public string DefaultModel => _options.GroqDefaultModel;

    // NOTE: Groq keys are "gsk_" and an opaque tail; marker and a floor, as for the others.
    public bool LooksLikeKey(string key) =>
        key.StartsWith("gsk_", StringComparison.Ordinal) && key.Length >= 20;

    public async Task<LlmValidationResult> ValidateAsync(
        string apiKey,
        CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{_options.GroqBaseUrl.TrimEnd('/')}/v1/models");

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        HttpResponseMessage response;

        try
        {
            response = await _http.SendAsync(request, cancellationToken);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return LlmValidationResult.Unreachable(
                $"Groq did not answer within {_options.ValidationTimeoutSeconds} seconds. " +
                "Your key has not been changed — try again in a moment.");
        }
        catch (HttpRequestException exception)
        {
            _logger.LogWarning(exception, "Could not reach the Groq API to validate a key.");
            return LlmValidationResult.Unreachable(
                "Could not reach Groq. Your key has not been changed — try again in a moment.");
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
                HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                    LlmValidationResult.Rejected(
                        "Groq rejected that key. Check you copied all of it, and that it has not been revoked."),

                HttpStatusCode.TooManyRequests =>
                    LlmValidationResult.Unreachable(
                        "Groq is rate limiting this key right now, so it could not be checked. Try again shortly."),

                >= HttpStatusCode.InternalServerError =>
                    LlmValidationResult.Unreachable(
                        "Groq returned an error, so the key could not be checked. Try again shortly."),

                _ => LlmValidationResult.Rejected(
                    $"Groq refused the check ({(int)response.StatusCode}). The key may be malformed.")
            };
        }
    }

    /// <summary>
    /// The active chat models, newest first. Groq's list also carries speech-to-text,
    /// text-to-speech and moderation models, which the pipeline cannot use.
    /// </summary>
    private IReadOnlyList<string> ReadModelIds(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);

            if (!document.RootElement.TryGetProperty("data", out var data) ||
                data.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<string>();
            }

            return data
                .EnumerateArray()
                .Where(entry => !entry.TryGetProperty("active", out var active) ||
                                active.ValueKind != JsonValueKind.False)
                .Select(entry => (
                    Id: entry.TryGetProperty("id", out var id) ? id.GetString() : null,
                    Created: entry.TryGetProperty("created", out var created) &&
                             created.TryGetInt64(out var seconds) ? seconds : 0))
                .Where(entry => IsChatModel(entry.Id))
                .OrderByDescending(entry => entry.Created)
                .Select(entry => entry.Id!)
                .ToList();
        }
        catch (JsonException exception)
        {
            _logger.LogWarning(exception, "The Groq models response could not be parsed.");
            return Array.Empty<string>();
        }
    }

    private static readonly string[] NonChatMarkers =
        ["whisper", "orpheus", "playai", "tts", "guard", "distil"];

    private static bool IsChatModel(string? id) =>
        !string.IsNullOrWhiteSpace(id) &&
        !NonChatMarkers.Any(marker => id.Contains(marker, StringComparison.OrdinalIgnoreCase));
}
