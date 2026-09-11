namespace Backend.Common.Options;

/// <summary>
/// Credentials and endpoint for an S3-compatible bucket. Used when
/// <c>Storage:Provider</c> is <see cref="StorageProvider.S3"/>.
/// </summary>
/// <remarks>
/// The bucket is expected to be private to immitate B2 free tier.
/// An injector will be used to invoke the media temp url every
/// time it expires and can be toggled on/off to just do normal
/// public url for a public bucket also.
/// </remarks>
public class S3Options
{
    public const string SectionName = "S3";

    /// <summary>SigV4 caps a presigned URL at one week, same ceiling B2 puts on a download token.</summary>
    public const int MaximumDownloadUrlSeconds = 60 * 60 * 24 * 7;

    public string AccessKeyId { get; set; } = string.Empty;

    public string SecretAccessKey { get; set; } = string.Empty;

    public string BucketName { get; set; } = string.Empty;

    public string? ServiceUrl { get; set; }

    public string Region { get; set; } = "us-east-1";

    /// <summary>
    /// Puts the bucket in the path rather than the hostname. MinIO is reached this way
    /// unless it has been given wildcard DNS, and <c>localhost</c> never has.
    /// </summary>
    public bool ForcePathStyle { get; set; } = true;

    public int DownloadUrlSeconds { get; set; } = 3600;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(AccessKeyId)
        && !string.IsNullOrWhiteSpace(SecretAccessKey)
        && !string.IsNullOrWhiteSpace(BucketName);

    public void Validate()
    {
        if (!IsConfigured)
        {
            var missing = new[]
            {
                string.IsNullOrWhiteSpace(AccessKeyId) ? nameof(AccessKeyId) : null,
                string.IsNullOrWhiteSpace(SecretAccessKey) ? nameof(SecretAccessKey) : null,
                string.IsNullOrWhiteSpace(BucketName) ? nameof(BucketName) : null
            }.Where(name => name is not null).ToArray();

            throw new InvalidOperationException(
                $"Configuration section '{SectionName}' is incomplete: " +
                $"the following required settings are missing: {string.Join(", ", missing)}. " +
                $"'{StorageOptions.SectionName}:{nameof(StorageOptions.Provider)}' selects this " +
                "provider — supply them through user secrets " +
                $"(dotnet user-secrets set \"{SectionName}:{nameof(AccessKeyId)}\" ...) or the " +
                $"environment ({SectionName}__{nameof(AccessKeyId)} and friends).");
        }

        if (DownloadUrlSeconds is < 1 or > MaximumDownloadUrlSeconds)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:{nameof(DownloadUrlSeconds)}' must be between 1 and " +
                $"{MaximumDownloadUrlSeconds} seconds.");
        }

        if (!string.IsNullOrWhiteSpace(ServiceUrl)
            && !Uri.TryCreate(ServiceUrl, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:{nameof(ServiceUrl)}' is not an absolute URL.");
        }
    }
}
