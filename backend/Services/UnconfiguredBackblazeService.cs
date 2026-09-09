using Backend.Common.Exceptions;
using Backend.Common.Options;

namespace Backend.Services;

/// <summary>
/// Stands in for <see cref="BackblazeService"/> when the deployment has no Backblaze
/// credentials. Only ever registered in Development behind <c>--noCheck</c>, so that
/// <c>dotnet ef</c> and the OpenAPI document generator can build the service graph without
/// a bucket to talk to.
/// </summary>
public class UnconfiguredBackblazeService : IBackblazeService
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
        new($"Media storage is unavailable: this instance started without a configured " +
            $"'{BackblazeOptions.SectionName}' section.");
}
