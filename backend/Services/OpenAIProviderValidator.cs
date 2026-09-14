using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Backend.Common.Options;
using Backend.Models.Entities;
using Microsoft.Extensions.Options;

namespace Backend.Services;

/// <summary>
/// Confirms an OpenAI key by listing the models it may use — free, and only refused for a
/// bad key. See <see cref="AnthropicProviderValidator"/> for why that beats a trial completion.
/// </summary>
public class OpenAIProviderValidator : ILlmProviderValidator
{
    private readonly HttpClient _http;
    private readonly LlmOptions _options;
    private readonly ILogger<OpenAIProviderValidator> _logger;

    public OpenAIProviderValidator(
        HttpClient http,
        IOptions<LlmOptions> options,
        ILogger<OpenAIProviderValidator> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public LlmProvider Provider => LlmProvider.OpenAI;

    public string DisplayName => "OpenAI";

    public string KeyPlaceholder => "sk-proj-...";

    public string DefaultModel => _options.OpenAIDefaultModel;

    // NOTE: project keys are "sk-proj-", older user and service keys plain "sk-"; all share
    // the "sk-" marker, so that and a floor are all this checks.
    public bool LooksLikeKey(string key) =>
        key.StartsWith("sk-", StringComparison.Ordinal) && key.Length >= 20;

    public async Task<LlmValidationResult> ValidateAsync(
        string apiKey,
        CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{_options.OpenAIBaseUrl.TrimEnd('/')}/v1/models");

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        HttpResponseMessage response;

        try
        {
            response = await _http.SendAsync(request, cancellationToken);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return LlmValidationResult.Unreachable(
                $"OpenAI did not answer within {_options.ValidationTimeoutSeconds} seconds. " +
                "Your key has not been changed — try again in a moment.");
        }
        catch (HttpRequestException exception)
        {
            _logger.LogWarning(exception, "Could not reach the OpenAI API to validate a key.");
            return LlmValidationResult.Unreachable(
                "Could not reach OpenAI. Your key has not been changed — try again in a moment.");
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
                        "OpenAI rejected that key. Check you copied all of it, and that it has not been revoked."),

                HttpStatusCode.TooManyRequests =>
                    LlmValidationResult.Unreachable(
                        "OpenAI is rate limiting this key right now, so it could not be checked. Try again shortly."),

                >= HttpStatusCode.InternalServerError =>
                    LlmValidationResult.Unreachable(
                        "OpenAI returned an error, so the key could not be checked. Try again shortly."),

                _ => LlmValidationResult.Rejected(
                    $"OpenAI refused the check ({(int)response.StatusCode}). The key may be malformed.")
            };
        }
    }

    /// <summary>
    /// The chat models out of a Models API response, newest first.
    ///
    /// OpenAI's list is unordered and also holds embedding, audio and image models, none of
    /// which the pipeline can use, so it is filtered to the GPT and o-series families and
    /// sorted by creation time.
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
            _logger.LogWarning(exception, "The OpenAI models response could not be parsed.");
            return Array.Empty<string>();
        }
    }

    private static bool IsChatModel(string? id) =>
        !string.IsNullOrWhiteSpace(id) &&
        (id.StartsWith("gpt-", StringComparison.Ordinal) ||
         (id.Length > 1 && id[0] == 'o' && char.IsDigit(id[1]))) &&
        !id.Contains("audio", StringComparison.Ordinal) &&
        !id.Contains("realtime", StringComparison.Ordinal) &&
        !id.Contains("transcribe", StringComparison.Ordinal) &&
        !id.Contains("tts", StringComparison.Ordinal) &&
        !id.Contains("image", StringComparison.Ordinal);
}
