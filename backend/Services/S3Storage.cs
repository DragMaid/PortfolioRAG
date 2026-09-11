using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Backend.Common.Exceptions;
using Backend.Common.Options;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Retry;

namespace Backend.Services;

/// <summary>
/// The bucket over the S3 API. Lets a MinIO container stand in for B2 during development,
/// and works unchanged against any other S3-compatible service.
/// </summary>
/// <remarks>
/// Written to behave as <see cref="BackblazeStorage"/> does rather than as S3 allows,
/// because the point of having both is that swapping them changes nothing above
/// <see cref="IObjectStorage"/>: the same retry policy, the same delete-every-version pass,
/// the same refusal of a non-seekable stream, and links that expire rather than a bucket
/// anyone can read.
/// </remarks>
public class S3Storage : IObjectStorage
{
    private readonly IAmazonS3 _client;
    private readonly ILogger<S3Storage> _logger;
    private readonly S3Options _options;
    private readonly ResiliencePipeline _retryPipeline;

    private readonly SemaphoreSlim _connectionLock = new(1, 1);
    private readonly bool _usePlainHttp;
    private bool _verified;

    public S3Storage(
        IAmazonS3 client,
        IOptions<S3Options> options,
        ILogger<S3Storage> logger)
    {
        _client = client;
        _logger = logger;
        _options = options.Value;

        _usePlainHttp = _options.ServiceUrl?
            .StartsWith("http://", StringComparison.OrdinalIgnoreCase) ?? false;

        _retryPipeline = new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = 3,
                Delay = TimeSpan.FromSeconds(1),
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                // NOTE: only handle very specific error responses else skipped
                ShouldHandle = new PredicateBuilder()
                    .Handle<AmazonS3Exception>(exception => IsTransient(exception.StatusCode))
                    .Handle<HttpRequestException>()
                    .Handle<TimeoutException>(),
                OnRetry = arguments =>
                {
                    _logger.LogWarning(
                        arguments.Outcome.Exception,
                        "S3 call failed, retrying (attempt {AttemptNumber}) after {RetryDelay}.",
                        arguments.AttemptNumber + 1,
                        arguments.RetryDelay);

                    return ValueTask.CompletedTask;
                }
            })
            .Build();
    }

    public async Task<StoredBlob> UploadAsync(
        Stream content,
        string objectKey,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(objectKey);

        if (!content.CanSeek)
        {
            throw new ArgumentException(
                "S3 needs the length of the whole body up front, and a retry has to rewind, " +
                "so the content stream must be seekable.",
                nameof(content));
        }

        await EnsureConnectedAsync(cancellationToken);

        var byteSize = content.Length;

        await _retryPipeline.ExecuteAsync(
            async token =>
            {
                // Every attempt starts from the beginning. A retry that resumed where the
                // failed one stopped would store a truncated file and report success.
                content.Position = 0;

                var request = new PutObjectRequest
                {
                    BucketName = _options.BucketName,
                    Key = objectKey,
                    InputStream = content,
                    ContentType = contentType,
                    // NOTE: the payload stays signed. Turning that off is the usual advice
                    // for a large upload, but the SDK refuses it over plain HTTP — which is
                    // exactly how MinIO is reached locally — and the body is already a
                    // MemoryStream by the time it arrives here, so there is nothing to save.
                    AutoCloseStream = false
                };

                return await _client.PutObjectAsync(request, token);
            },
            cancellationToken);

        _logger.LogDebug(
            "Stored {ObjectKey} ({ByteSize} bytes, {ContentType}).",
            objectKey,
            byteSize,
            contentType);

        return new StoredBlob(objectKey, byteSize, contentType);
    }

    public async Task<Uri> GetDownloadUrlAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(objectKey);

        await EnsureConnectedAsync(cancellationToken);

        // NOTE: signed locally from the credentials, so unlike B2's download token there is
        // nothing to fetch and nothing worth caching. The deadline is the only thing
        // standing between a leaked link and the object, which is why it is short.
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _options.BucketName,
            Key = objectKey,
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.AddSeconds(_options.DownloadUrlSeconds),
            // NOTE: the presigner defaults to HTTPS and does not consult the endpoint's own
            // scheme, so a MinIO container listening on plain HTTP would otherwise be handed
            // out as https:// and connect to nothing. It only shows up when something
            // actually follows the link, which is why it is pinned here rather than left
            // to the client configuration.
            Protocol = _usePlainHttp ? Protocol.HTTP : Protocol.HTTPS
        };

        return new Uri(await _client.GetPreSignedURLAsync(request), UriKind.Absolute);
    }

    public async Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(objectKey);

        await EnsureConnectedAsync(cancellationToken);

        var request = new ListVersionsRequest
        {
            BucketName = _options.BucketName,
            Prefix = objectKey
        };

        var results = await _retryPipeline.ExecuteAsync(
            async token => await _client.ListVersionsAsync(request, token),
            cancellationToken);

        // The listing matches on prefix, so a key that happens to start with this one would
        // come back too. Only the exact name is ours to delete.
        //
        // NOTE: an unversioned bucket — which is what MinIO gives you unless you ask
        // otherwise — reports exactly one entry per key with a "null" version id, so this
        // does the right thing either way rather than needing to know which it is.
        var versions = results.Versions
            .Where(version => string.Equals(version.Key, objectKey, StringComparison.Ordinal))
            .ToList();

        if (versions.Count == 0)
        {
            _logger.LogDebug("Nothing to delete at {ObjectKey}; the bucket has no version of it.", objectKey);
            return;
        }

        foreach (var version in versions)
        {
            await _retryPipeline.ExecuteAsync(
                async token => await _client.DeleteObjectAsync(
                    new DeleteObjectRequest
                    {
                        BucketName = _options.BucketName,
                        Key = version.Key,
                        VersionId = version.VersionId
                    },
                    token),
                cancellationToken);
        }

        _logger.LogDebug("Deleted {VersionCount} version(s) of {ObjectKey}.", versions.Count, objectKey);
    }

    public async Task<IReadOnlyList<BlobItem>> ListAsync(
        string prefix,
        CancellationToken cancellationToken = default)
    {
        await EnsureConnectedAsync(cancellationToken);

        var items = new List<BlobItem>();
        string? continuationToken = null;

        do
        {
            var request = new ListObjectsV2Request
            {
                BucketName = _options.BucketName,
                Prefix = prefix,
                ContinuationToken = continuationToken
            };

            var results = await _retryPipeline.ExecuteAsync(
                async token => await _client.ListObjectsV2Async(request, token),
                cancellationToken);

            // NOTE: a listing does not carry content types — S3 only reports those on a HEAD
            // of each object, and a prefix sweep exists precisely to avoid one call per key.
            // Nothing reading BlobItem.ContentType off a listing needs it: PurgePrefixAsync
            // only wants the keys.
            items.AddRange(results.S3Objects.Select(item => new BlobItem(
                item.Key,
                item.Size ?? 0,
                "application/octet-stream",
                new DateTimeOffset(DateTime.SpecifyKind(item.LastModified ?? default, DateTimeKind.Utc)))));

            continuationToken = (results.IsTruncated ?? false) ? results.NextContinuationToken : null;
        }
        while (continuationToken is not null);

        return items;
    }

    public async Task<IReadOnlyList<string>> GetPermittedBucketNamesAsync(
        CancellationToken cancellationToken = default)
    {
        var results = await _retryPipeline.ExecuteAsync(
            async token => await _client.ListBucketsAsync(token),
            cancellationToken);

        return results.Buckets.Select(bucket => bucket.BucketName).ToList();
    }

    /// <summary>
    /// Confirms the configured bucket exists and these credentials can reach it. Runs once;
    /// every later call finds the flag already set.
    /// </summary>
    private async Task EnsureConnectedAsync(CancellationToken cancellationToken)
    {
        if (_verified)
            return;

        await _connectionLock.WaitAsync(cancellationToken);

        try
        {
            if (_verified)
                return;

            // A HEAD of the bucket is both an existence check and a permission check, and
            // unlike listing every bucket it works with a key scoped to this one alone.
            var found = await _retryPipeline.ExecuteAsync(
                async token =>
                {
                    try
                    {
                        await _client.GetBucketLocationAsync(_options.BucketName, token);
                        return true;
                    }
                    catch (AmazonS3Exception exception)
                        when (exception.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden)
                    {
                        return false;
                    }
                },
                cancellationToken);

            if (!found)
            {
                throw new NotConfiguredException(
                    $"S3 bucket '{_options.BucketName}' does not exist or these credentials cannot " +
                    $"see it. Check '{S3Options.SectionName}:{nameof(S3Options.BucketName)}' and the " +
                    $"endpoint at '{S3Options.SectionName}:{nameof(S3Options.ServiceUrl)}' " +
                    $"({_options.ServiceUrl ?? "AWS " + _options.Region}).");
            }

            _logger.LogInformation(
                "S3 storage ready: bucket {BucketName} at {ServiceUrl}, links expire after {Seconds}s.",
                _options.BucketName,
                _options.ServiceUrl ?? $"AWS {_options.Region}",
                _options.DownloadUrlSeconds);

            _verified = true;
        }
        finally
        {
            _connectionLock.Release();
        }
    }

    private static bool IsTransient(HttpStatusCode statusCode) => statusCode is
        HttpStatusCode.RequestTimeout or
        HttpStatusCode.TooManyRequests or
        HttpStatusCode.InternalServerError or
        HttpStatusCode.BadGateway or
        HttpStatusCode.ServiceUnavailable or
        HttpStatusCode.GatewayTimeout;
}
