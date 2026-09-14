namespace Backend.Common.Options;

/// <summary>
/// How the API handles the provider keys authors entrust to it, and what the pipeline they
/// pay for is allowed to cost them.
/// </summary>
public class LlmOptions
{
    public const string SectionName = "Llm";

    /// <summary>
    /// Base64 of the 32 bytes that seal every stored provider key. Required outside
    /// Development, and rotating it makes every stored key unreadable — which is a
    /// recoverable failure (each author re-enters a key) rather than a breach.
    /// </summary>
    public string EncryptionKey { get; set; } = string.Empty;

    /// <summary>
    /// How long the API waits for a provider to confirm a key. Short on purpose: this sits
    /// on a form submit, and a provider that is slow to answer is a provider that is down.
    /// </summary>
    public int ValidationTimeoutSeconds { get; set; } = 15;

    /// TODO: I should really move all these things to a default setting file
    /// <summary>
    /// The model a newly saved credential is given. An author may change it afterwards; the
    /// validation call returns the list they may choose from.
    /// </summary>
    public string DefaultModel { get; set; } = "claude-opus-5";

    /// <summary>
    /// The longest job description the public endpoint will take. A ceiling on the prompt
    /// is a ceiling on the bill, and it is the only one that acts before the money is spent
    /// rather than after.
    /// </summary>
    public int MaxJobDescriptionChars { get; set; } = 20000;

    /// <summary>Where the provider's API lives. Overridable so tests can point it at a stub.</summary>
    public string AnthropicBaseUrl { get; set; } = "https://api.anthropic.com";

    /// <summary>The model a newly saved OpenAI credential is given.</summary>
    public string OpenAIDefaultModel { get; set; } = "gpt-6-astra";

    public string OpenAIBaseUrl { get; set; } = "https://api.openai.com";

    /// <summary>
    /// The model a newly saved Gemini credential is given. A stable model rather than a
    /// preview, which could be withdrawn from under a stored credential.
    /// </summary>
    public string GeminiDefaultModel { get; set; } = "gemini-3.8-flash";

    public string GeminiBaseUrl { get; set; } = "https://generativelanguage.googleapis.com";

    public const int EncryptionKeyBytes = 32;

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(EncryptionKey))
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:EncryptionKey' is required: it is what the provider keys " +
                "authors enter are sealed with, and without it they would be stored in the clear. Supply " +
                $"{EncryptionKeyBytes} random bytes, base64-encoded, through user secrets or Llm__EncryptionKey. " +
                "Generate one with: openssl rand -base64 32");
        }

        if (!TryDecodeKey(EncryptionKey, out _))
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:EncryptionKey' is not {EncryptionKeyBytes} base64-encoded bytes. " +
                "Generate one with: openssl rand -base64 32");
        }

        if (ValidationTimeoutSeconds <= 0)
            throw new InvalidOperationException($"Configuration '{SectionName}:ValidationTimeoutSeconds' must be positive.");

        if (MaxJobDescriptionChars <= 0)
            throw new InvalidOperationException($"Configuration '{SectionName}:MaxJobDescriptionChars' must be positive.");
    }

    /// <summary>True when the string is exactly the key material AES-GCM wants.</summary>
    public static bool TryDecodeKey(string value, out byte[] key)
    {
        key = Array.Empty<byte>();

        Span<byte> buffer = stackalloc byte[EncryptionKeyBytes + 1];

        if (!Convert.TryFromBase64String(value, buffer, out var written) || written != EncryptionKeyBytes)
            return false;

        key = buffer[..written].ToArray();
        return true;
    }
}
