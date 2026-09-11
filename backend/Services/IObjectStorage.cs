namespace Backend.Services;

/// <summary>What the bucket now holds after an upload.</summary>
/// <param name="ObjectKey">The full key the content was stored under.</param>
public sealed record StoredBlob(string ObjectKey, long ByteSize, string ContentType);

/// <summary>One object as the bucket reports it.</summary>
public sealed record BlobItem(string ObjectKey, long ByteSize, string ContentType, DateTimeOffset UploadedAt);

/// <summary>
/// The bucket, as the rest of the API sees it: keys in, signed links out. Nothing here
/// knows about posts, authors or permissions — <c>IMediaService</c> owns those, and every
/// caller of this interface has already decided the operation is allowed.
/// </summary>
/// <remarks>
/// <para>
/// Media lives in a private bucket, so there is no such thing as a permanent address for a
/// stored object. <see cref="GetDownloadUrlAsync"/> mints a link that expires, which is why
/// media rows store keys and the API redirects rather than handing out URLs to embed.
/// </para>
/// <para>
/// Two implementations answer this contract and a deployment picks one with
/// <c>Storage:Provider</c>: <see cref="BackblazeStorage"/> speaks B2's own API, and
/// <see cref="S3Storage"/> speaks S3 — which is what lets a MinIO container stand in for
/// the bucket locally. Everything either one exposes has to be true of both, so the
/// interface promises a key, a size and a link with a deadline, and nothing about how the
/// provider arrived at them.
/// </para>
/// </remarks>
public interface IObjectStorage
{
    /// <summary>
    /// Stores <paramref name="content"/> under <paramref name="objectKey"/>, overwriting any
    /// object already there.
    /// </summary>
    /// <param name="content">
    /// Must be seekable: a retried attempt rewinds it, and both providers want the length
    /// and checksum of the whole body before they will accept the first byte.
    /// </param>
    Task<StoredBlob> UploadAsync(
        Stream content,
        string objectKey,
        string contentType,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// A signed link to one object, valid for the configured window.
    /// </summary>
    /// <remarks>
    /// The two providers reach this differently and the difference is deliberately not
    /// visible here: B2 mints one authorization per containing folder and caches it, so a
    /// post's images cost one call between them, while S3 signs each object's URL locally
    /// with no round trip at all.
    /// </remarks>
    Task<Uri> GetDownloadUrlAsync(string objectKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes every version of an object. Both providers keep supersedes rather than
    /// overwriting when versioning is on, and a version nothing points at is a bill nobody
    /// is watching.
    /// </summary>
    Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default);

    /// <summary>Everything stored under a key prefix, oldest listing order.</summary>
    Task<IReadOnlyList<BlobItem>> ListAsync(string prefix, CancellationToken cancellationToken = default);

    /// <summary>
    /// The buckets the credentials are allowed to see. Used to explain a misconfigured
    /// bucket name, and worth having on hand when a key turns out to be scoped elsewhere.
    /// </summary>
    Task<IReadOnlyList<string>> GetPermittedBucketNamesAsync(CancellationToken cancellationToken = default);
}
