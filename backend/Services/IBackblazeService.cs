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
/// Media lives in a private bucket, so there is no such thing as a permanent address for a
/// stored object. <see cref="GetDownloadUrlAsync"/> mints a link that expires, which is why
/// media rows store keys and the API redirects rather than handing out URLs to embed.
/// </remarks>
public interface IBackblazeService
{
    /// <summary>
    /// Stores <paramref name="content"/> under <paramref name="objectKey"/>, overwriting any
    /// object already there.
    /// </summary>
    /// <param name="content">
    /// Must be seekable: a retried attempt rewinds it, and B2 needs the length and checksum
    /// of the whole body before it will accept the first byte.
    /// </param>
    Task<StoredBlob> UploadAsync(
        Stream content,
        string objectKey,
        string contentType,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// A signed link to one object, valid for the configured window. Authorization is minted
    /// per containing folder and cached, so a post's images cost one call between them.
    /// </summary>
    Task<Uri> GetDownloadUrlAsync(string objectKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes every version of an object. B2 keeps supersedes rather than overwriting, and
    /// a version nothing points at is a bill nobody is watching.
    /// </summary>
    Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default);

    /// <summary>Everything stored under a key prefix, oldest listing order.</summary>
    Task<IReadOnlyList<BlobItem>> ListAsync(string prefix, CancellationToken cancellationToken = default);

    /// <summary>
    /// The buckets the application key is allowed to see. Used to explain a misconfigured
    /// bucket name, and worth having on hand when a key turns out to be scoped elsewhere.
    /// </summary>
    Task<IReadOnlyList<string>> GetPermittedBucketNamesAsync(CancellationToken cancellationToken = default);
}
