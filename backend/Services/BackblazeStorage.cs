using System.Net;
using Backend.Common.Exceptions;
using Backend.Common.Options;
using Bytewizer.Backblaze;
using Bytewizer.Backblaze.Client;
using Bytewizer.Backblaze.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Retry;

namespace Backend.Services;

public class BackblazeStorage : IObjectStorage
{
    private readonly IStorageClient _client;
    private readonly IMemoryCache _cache;
    private readonly ILogger<BackblazeStorage> _logger;
    private readonly BackblazeOptions _options;
    private readonly ResiliencePipeline _retryPipeline;

    private readonly SemaphoreSlim _connectionLock = new(1, 1);
    private string? _bucketId;
    private Uri? _downloadUrl;

    private static readonly TimeSpan ListingCacheTtl = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan DeleteListingCacheTtl = TimeSpan.FromSeconds(1);

    public BackblazeStorage(
        IStorageClient client,
        IMemoryCache cache,
        IOptions<BackblazeOptions> options,
        ILogger<BackblazeStorage> logger)
    {
        _client = client;
        _cache = cache;
        _logger = logger;
        _options = options.Value;

        _retryPipeline = new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = 3,
                Delay = TimeSpan.FromSeconds(1),
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                // NOTE: only handle very specific error responses else skipped
                ShouldHandle = new PredicateBuilder()
                    .Handle<ApiException>(exception => IsTransient(exception.StatusCode))
                    .Handle<HttpRequestException>()
                    .Handle<TimeoutException>(),
                OnRetry = arguments =>
                {
                    _logger.LogWarning(
                        arguments.Outcome.Exception,
                        "Backblaze call failed, retrying (attempt {AttemptNumber}) after {RetryDelay}.",
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
                "Backblaze needs the length and checksum of the whole body up front, and a retry " +
                "has to rewind, so the content stream must be seekable.",
                nameof(content));
        }

        var bucketId = await EnsureConnectedAsync(cancellationToken);

        var results = await _retryPipeline.ExecuteAsync(
            async token =>
            {
                // Every attempt starts from the beginning. A retry that resumed where the
                // failed one stopped would store a truncated file and report success.
                content.Position = 0;

                var request = new UploadFileByBucketIdRequest(bucketId, objectKey)
                {
                    ContentType = contentType
                };

                var response = await _client.UploadAsync(request, content, null, token);
                return response.EnsureSuccessStatusCode();
            },
            cancellationToken);

        var byteSize = results.Response.ContentLength;

        _logger.LogDebug(
            "Stored {ObjectKey} ({ByteSize} bytes, {ContentType}) as file {FileId}.",
            objectKey,
            byteSize,
            contentType,
            results.Response.FileId);

        return new StoredBlob(objectKey, byteSize, contentType);
    }

    public async Task<Uri> GetDownloadUrlAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(objectKey);

        await EnsureConnectedAsync(cancellationToken);

        // Instead of generating download tokens for each of the objects
        // Each post have all its media in a folder and download that folder instead
        var prefix = FolderPrefixOf(objectKey);
        var token = await GetDownloadTokenAsync(prefix, cancellationToken);

        // The key is a path: escape the segments, keep the separators.
        var escapedKey = string.Join('/', objectKey.Split('/').Select(u => Uri.EscapeDataString(u)));

        return new Uri(
            $"{_downloadUrl!.ToString().TrimEnd('/')}/file/{Uri.EscapeDataString(_options.BucketName)}/{escapedKey}" +
            $"?Authorization={Uri.EscapeDataString(token)}");
    }

    public async Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(objectKey);

        var bucketId = await EnsureConnectedAsync(cancellationToken);

        var request = new ListFileVersionRequest(bucketId)
        {
            Prefix = objectKey,
            MaxFileCount = ListFileVersionRequest.MaximumFilesPerTransaction
        };

        var results = await _retryPipeline.ExecuteAsync(
            async _ => (await _client.Files.ListVersionsAsync(request, DeleteListingCacheTtl)).EnsureSuccessStatusCode(),
            cancellationToken);

        // The listing matches on prefix, so a key that happens to start with this one would
        // come back too. Only the exact name is ours to delete.
        var versions = results.Response.Files
            .Where(file => string.Equals(file.FileName, objectKey, StringComparison.Ordinal))
            .ToList();

        if (versions.Count == 0)
        {
            _logger.LogDebug("Nothing to delete at {ObjectKey}; the bucket has no version of it.", objectKey);
            return;
        }

        foreach (var version in versions)
        {
            await _retryPipeline.ExecuteAsync(
                async _ => (await _client.Files.DeleteAsync(version.FileId, version.FileName)).EnsureSuccessStatusCode(),
                cancellationToken);
        }

        _logger.LogDebug("Deleted {VersionCount} version(s) of {ObjectKey}.", versions.Count, objectKey);
    }

    public async Task<IReadOnlyList<BlobItem>> ListAsync(
        string prefix,
        CancellationToken cancellationToken = default)
    {
        var bucketId = await EnsureConnectedAsync(cancellationToken);

        var items = new List<BlobItem>();
        string? startFileName = null;

        do
        {
            var request = new ListFileNamesRequest(bucketId)
            {
                Prefix = prefix,
                MaxFileCount = ListFileNamesRequest.MaximumFilesPerTransaction,
                StartFileName = startFileName
            };

            var results = await _retryPipeline.ExecuteAsync(
                async _ => (await _client.Files.ListNamesAsync(request, ListingCacheTtl)).EnsureSuccessStatusCode(),
                cancellationToken);

            items.AddRange(results.Response.Files.Select(file => new BlobItem(
                file.FileName,
                file.ContentLength,
                file.ContentType,
                new DateTimeOffset(DateTime.SpecifyKind(file.UploadTimestamp, DateTimeKind.Utc)))));

            startFileName = results.Response.NextFileName;
        }
        while (!string.IsNullOrEmpty(startFileName));

        return items;
    }

    public async Task<IReadOnlyList<string>> GetPermittedBucketNamesAsync(
        CancellationToken cancellationToken = default)
    {
        var results = await _retryPipeline.ExecuteAsync(
            async _ => (await _client.Buckets.ListAsync()).EnsureSuccessStatusCode(),
            cancellationToken);

        return results.Response.Buckets.Select(bucket => bucket.BucketName).ToList();
    }

    /// <summary>
    /// Authorizes the account, then resolves the configured bucket name against the buckets
    /// the key can actually reach. Runs once; every later call reads the cached id.
    /// </summary>
    private async Task<string> EnsureConnectedAsync(CancellationToken cancellationToken)
    {
        if (_bucketId is not null)
            return _bucketId;

        await _connectionLock.WaitAsync(cancellationToken);

        try
        {
            if (_bucketId is not null)
                return _bucketId;

            var authorization = await _retryPipeline.ExecuteAsync(
                async _ => await _client.ConnectAsync(),
                cancellationToken);

            // A bucket-restricted key sees exactly its own bucket here, which is what makes
            // this both an existence check and a permission check in one call.
            var results = await _retryPipeline.ExecuteAsync(
                async _ => (await _client.Buckets.ListAsync()).EnsureSuccessStatusCode(),
                cancellationToken);

            var permitted = results.Response.Buckets;

            // Check for all the bucketnames to see if one match the configured target
            var bucket = permitted
                .FirstOrDefault(candidate => string.Equals(
                    candidate.BucketName,
                    _options.BucketName,
                    StringComparison.Ordinal));

            if (bucket is null)
            {
                throw new NotConfiguredException(
                    $"Backblaze bucket '{_options.BucketName}' does not exist or this application key " +
                    $"cannot see it. The key is permitted to use: " +
                    $"{(permitted.Count == 0 ? "no buckets at all" : string.Join(", ", permitted.Select(b => b.BucketName)))}.");
            }

            _downloadUrl = ResolveDownloadUrl(authorization);

            _logger.LogInformation(
                "Backblaze ready: bucket {BucketName} ({BucketId}), downloads from {DownloadUrl}.",
                bucket.BucketName,
                bucket.BucketId,
                _downloadUrl);

            _bucketId = bucket.BucketId;
            return _bucketId;
        }
        finally
        {
            _connectionLock.Release();
        }
    }

    private Uri ResolveDownloadUrl(AuthorizeAccountResponse authorization)
    {
        // NOTE: DownloadUrl here means the base url for furhter accessing other files
        if (!string.IsNullOrWhiteSpace(_options.DownloadUrl))
            return new Uri(_options.DownloadUrl, UriKind.Absolute);

        // If not preconfigured then get from authorization
        var reported = authorization.DownloadUrl?.ToString();

        if (string.IsNullOrWhiteSpace(reported))
        {
            throw new NotConfiguredException(
                "Backblaze did not report a download address for this account. Set " +
                $"'{BackblazeOptions.SectionName}:{nameof(BackblazeOptions.DownloadUrl)}' explicitly.");
        }

        return new Uri(reported, UriKind.Absolute);
    }

    private async Task<string> GetDownloadTokenAsync(string prefix, CancellationToken cancellationToken)
    {
        var cacheKey = $"b2:download-token:{_options.BucketName}:{prefix}";

        // Retrieve and return cache immediately if available
        if (_cache.TryGetValue<string>(cacheKey, out var cached) && cached is not null)
            return cached;

        var bucketId = _bucketId!;

        var results = await _retryPipeline.ExecuteAsync(
            async _ => (await _client.Files.GetDownloadTokenAsync(
                bucketId,
                prefix,
                _options.DownloadTokenSeconds)).EnsureSuccessStatusCode(),
            cancellationToken);

        var token = results.Response.AuthorizationToken;

        // NOTE: dropped the cache expiration rate, avoid immediate retriaval after expiration
        var lifetime = TimeSpan.FromSeconds(Math.Max(_options.DownloadTokenSeconds / 2d, 30));
        _cache.Set(cacheKey, token, lifetime);

        _logger.LogDebug(
            "Minted a download token for {Prefix}, cached for {Lifetime}.",
            prefix,
            lifetime);

        return token;
    }

    /// <summary>The folder an object sits in, including the trailing slash. Empty at the root.</summary>
    private static string FolderPrefixOf(string objectKey)
    {
        var lastSeparator = objectKey.LastIndexOf('/');
        return lastSeparator < 0 ? string.Empty : objectKey[..(lastSeparator + 1)];
    }

    private static bool IsTransient(HttpStatusCode statusCode) => statusCode is
        HttpStatusCode.RequestTimeout or
        HttpStatusCode.TooManyRequests or
        HttpStatusCode.InternalServerError or
        HttpStatusCode.BadGateway or
        HttpStatusCode.ServiceUnavailable or
        HttpStatusCode.GatewayTimeout;
}
