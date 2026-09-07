namespace Backend.Common.Options;

public class GoogleAuthOptions
{
    public const string SectionName = "Authentication:Google";

    /// <summary>
    /// The OAuth client id the frontend used to obtain the ID token. It is also the
    /// audience every incoming Google token must carry — leaving it empty disables
    /// Google sign-in instead of accepting tokens minted for some other application.
    /// </summary>
    public string ClientId { get; set; } = string.Empty;

    public string MetadataAddress { get; set; } = "https://accounts.google.com/.well-known/openid-configuration";

    public IReadOnlyList<string> ValidIssuers { get; set; } =
        new[] { "https://accounts.google.com", "accounts.google.com" };

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ClientId);
}
