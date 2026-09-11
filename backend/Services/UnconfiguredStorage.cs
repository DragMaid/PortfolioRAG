using Backend.Common.Exceptions;
using Backend.Common.Options;

namespace Backend.Services;

/// <summary>
/// Stands in for a real bucket when the deployment has no storage credentials. Only ever
/// registered in Development behind <c>--noCheck</c>, so that <c>dotnet ef</c> and the
/// OpenAPI document generator can build the service graph without a bucket to talk to.
/// </summary>
public class UnconfiguredStorage : IObjectStorage
{
    public Task<StoredBlob> UploadAsync(
        Stream content,
        string objectKey,
        string contentType,
        CancellationToken cancellationToken = default) => throw Unavailable();

    public Task<Uri> GetDownloadUrlAsync(string objectKey, CancellationToken cancellationToken = default) =>
        throw Unavailable();

    public Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default) =>
        throw Unavailable();

    public Task<IReadOnlyList<BlobItem>> ListAsync(string prefix, CancellationToken cancellationToken = default) =>
        throw Unavailable();

    public Task<IReadOnlyList<string>> GetPermittedBucketNamesAsync(CancellationToken cancellationToken = default) =>
        throw Unavailable();

    private static NotConfiguredException Unavailable() =>
        new("Media storage is unavailable: this instance started without credentials for the " +
            $"provider named by '{StorageOptions.SectionName}:{nameof(StorageOptions.Provider)}' " +
            $"(sections '{BackblazeOptions.SectionName}' and '{S3Options.SectionName}').");
}
