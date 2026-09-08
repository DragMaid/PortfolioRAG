namespace Backend.Common.Options;

/// <summary>
/// Backblaze B2 credentials and bucket. The bucket is private, so nothing stored against a
/// media row is a public address — every read is handed out as a short-lived signed link
/// minted by <c>IBackblazeService</c>.
/// </summary>
public class BackblazeOptions
{
    public const string SectionName = "Backblaze";

    /// <summary>B2 refuses a download temporary url valid for longer than a week</summary>
    public const int MaximumDownloadTokenSeconds = 60 * 60 * 24 * 7;

    public string KeyId { get; set; } = string.Empty;

    public string ApplicationKey { get; set; } = string.Empty;

    public string BucketName { get; set; } = string.Empty;

    /// <summary>
    /// Overrides the download host reported by b2_authorize_account. Only needed when
    /// something sits in front of the bucket; empty means ask B2 where its files live.
    /// </summary>
    public string? DownloadUrl { get; set; }

    /// <summary>
    /// How long a signed download link stays valid. Long enough that a reader's images do
    /// not expire mid-article, short enough that a leaked link is worthless by the time it
    /// is shared. Tokens are cached per post for slightly less than this.
    /// </summary>
    public int DownloadTokenSeconds { get; set; } = 3600;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(KeyId)
        && !string.IsNullOrWhiteSpace(ApplicationKey)
        && !string.IsNullOrWhiteSpace(BucketName);

    /// <summary>
    /// Throws when the section is present but unusable. A section that is entirely absent is
    /// not an error — see <see cref="IsConfigured"/>.
    /// </summary>
    public void Validate()
    {
        if (!IsConfigured)
        {
            var missing = new[]
            {
                string.IsNullOrWhiteSpace(KeyId) ? nameof(KeyId) : null,
                string.IsNullOrWhiteSpace(ApplicationKey) ? nameof(ApplicationKey) : null,
                string.IsNullOrWhiteSpace(BucketName) ? nameof(BucketName) : null
            }.Where(name => name is not null).ToArray();

            throw new InvalidOperationException(
                $"Configuration section '{SectionName}' is incomplete: " +
                $"the following required settings are missing: {string.Join(", ", missing)}. " +
                $"Set KeyId, ApplicationKey and BucketName (user secrets, or " +
                $"{SectionName}__KeyId and friends in the environment), or remove the section " +
                "entirely to run without media uploads.");
        }

        if (DownloadTokenSeconds is < 1 or > MaximumDownloadTokenSeconds)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:{nameof(DownloadTokenSeconds)}' must be between 1 and " +
                $"{MaximumDownloadTokenSeconds} seconds.");
        }

        // NOTE: try parsing the url as an absolute URI for validation
        if (!string.IsNullOrWhiteSpace(DownloadUrl)
            && !Uri.TryCreate(DownloadUrl, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:{nameof(DownloadUrl)}' is not an absolute URL.");
        }
    }
}
