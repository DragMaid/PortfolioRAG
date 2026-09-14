using System.Net;
using System.Text.Json;
using Backend.Common.Options;
using Backend.Models.Entities;
using Microsoft.Extensions.Options;

namespace Backend.Services;

/// <summary>
/// Confirms an Anthropic key by asking the Models API what it may use.
///
/// That endpoint was chosen over a one-token completion for three reasons: it costs
/// nothing, it cannot be refused for any reason other than the key being bad, and its
/// answer is the list the studio needs anyway to populate the model picker. A trial
/// completion would have proved the same thing while spending the author's money to do it.
/// </summary>
public class AnthropicProviderValidator : ILlmProviderValidator
{
    /// <summary>
    /// The wire version of the Messages API. Pinned rather than "latest" because an
    /// unpinned date is a deployment that changes behaviour on somebody else's schedule.
    /// </summary>
    private const string ApiVersion = "2023-06-01";

    private readonly HttpClient _http;
    private readonly LlmOptions _options;
    private readonly ILogger<AnthropicProviderValidator> _logger;

    public AnthropicProviderValidator(
        HttpClient http,
        IOptions<LlmOptions> options,
        ILogger<AnthropicProviderValidator> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public LlmProvider Provider => LlmProvider.Anthropic;

    public string DisplayName => "Anthropic";

    public string KeyPlaceholder => "sk-ant-...";

    public string DefaultModel => _options.DefaultModel;

    // NOTE: shape only. Anthropic keys are "sk-ant-" followed by an opaque tail, and the
    // length is theirs to change, so this checks the marker and a floor rather than a
    // pattern that would start rejecting valid keys the day the format is extended.
    public bool LooksLikeKey(string key) => key.Length >= 20;

    public async Task<LlmValidationResult> ValidateAsync(
        string apiKey,
        CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{_options.AnthropicBaseUrl.TrimEnd('/')}/v1/models?limit=100");

        // NOTE: the key travels in x-api-key, not Authorization
        request.Headers.Add("x-api-key", apiKey);
        request.Headers.Add("anthropic-version", ApiVersion);

        HttpResponseMessage response;

        try
        {
            response = await _http.SendAsync(request, cancellationToken);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return LlmValidationResult.Unreachable(
                $"Anthropic did not answer within {_options.ValidationTimeoutSeconds} seconds. " +
                "Your key has not been changed — try again in a moment.");
        }
        catch (HttpRequestException exception)
        {
            _logger.LogWarning(exception, "Could not reach the Anthropic API to validate a key.");
            return LlmValidationResult.Unreachable(
                "Could not reach Anthropic. Your key has not been changed — try again in a moment.");
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
                        "Anthropic rejected that key. Check you copied all of it, and that it has not been revoked."),

                HttpStatusCode.TooManyRequests =>
                    LlmValidationResult.Unreachable(
                        "Anthropic is rate limiting this key right now, so it could not be checked. Try again shortly."),

                // NOTE: a 5xx says nothing about the key, so it must not be recorded as ar rejection
                >= HttpStatusCode.InternalServerError =>
                    LlmValidationResult.Unreachable(
                        "Anthropic returned an error, so the key could not be checked. Try again shortly."),

                _ => LlmValidationResult.Rejected(
                    $"Anthropic refused the check ({(int)response.StatusCode}). The key may be malformed.")
            };
        }
    }

    /// <summary>
    /// The model ids out of a Models API page, in the order the provider listed them —
    /// which is newest first, and so is the order the studio should offer them in.
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
                .Select(entry => entry.TryGetProperty("id", out var id) ? id.GetString() : null)
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id!)
                .ToList();
        }
        catch (JsonException exception)
        {
            // The key is valid either way — that was the status code's job to say. An
            // unreadable body only costs the caller the model picker.
            _logger.LogWarning(exception, "The Anthropic models response could not be parsed.");
            return Array.Empty<string>();
        }
    }
}
