using Backend.Services;

namespace Backend.Tests;

/// <summary>
/// An in-memory bucket. It keeps the bytes, so a test can assert on what was actually
/// stored — that a JPEG came back out as WebP, that deleting a post emptied its folder —
/// rather than only on the rows that point at it.
/// </summary>
/// <remarks>
/// The fidelity that matters is in the edges, and each one mirrors something the real
/// <see cref="BackblazeService"/> does: a non-seekable stream is refused, deleting a key
/// that is not there is a no-op, and a download URL is minted without checking that
/// anything is behind it.
/// </remarks>
public sealed class FakeBackblazeService : IBackblazeService
{
    public sealed record StoredObject(
        byte[] Content,
        string ContentType,
        DateTimeOffset UploadedAt,
        long Sequence);

    private readonly Dictionary<string, StoredObject> _objects = new(StringComparer.Ordinal);
    private long _sequence;

    public IReadOnlyDictionary<string, StoredObject> Objects => _objects;

    public List<string> UploadedKeys { get; } = new();

    public List<string> DeletedKeys { get; } = new();

    /// <summary>
    /// Return an exception from these to make the matching call fail. They reach the paths
    /// that exist for a bucket having a bad day: the best-effort delete of a replaced
    /// avatar, and the purge that must not be able to keep an account open.
    /// </summary>
    public Func<string, Exception?>? FailUpload { get; set; }

    public Func<string, Exception?>? FailDelete { get; set; }

    public Func<string, Exception?>? FailList { get; set; }

    public Task<StoredBlob> UploadAsync(
        Stream content,
        string objectKey,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        // The real client needs the length and checksum up front and rewinds to retry, so
        // it rejects a stream it cannot seek. A fake that accepted one would hide the bug.
        if (!content.CanSeek)
            throw new ArgumentException("The content stream must be seekable.", nameof(content));

        // NOTE: Invoke is used to call a delegate
        // and { } failure means if the result is not null then save to var failure
        var failure = FailUpload?.Invoke(objectKey);
        if (failure is not null)
            throw failure;

        content.Position = 0;
        using var buffer = new MemoryStream();
        content.CopyTo(buffer);
        var bytes = buffer.ToArray();

        _objects[objectKey] = new StoredObject(bytes, contentType, DateTimeOffset.UtcNow, _sequence++);
        UploadedKeys.Add(objectKey);
        return Task.FromResult(new StoredBlob(objectKey, bytes.Length, contentType));
    }

    public Task<Uri> GetDownloadUrlAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        // B2 signs a prefix, not an object, so it will happily mint a link for a key that
        // holds nothing. Existence is not checked here either.
        return Task.FromResult(new Uri(
            $"https://fake-b2.test/file/fake-bucket/{objectKey}?Authorization=fake-token"));
    }

    public Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        if (FailDelete?.Invoke(objectKey) is { } failure)
            throw failure;

        // Deleting something that is not there is a no-op, as it is against the real bucket.
        _objects.Remove(objectKey);
        DeletedKeys.Add(objectKey);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<BlobItem>> ListAsync(
        string prefix,
        CancellationToken cancellationToken = default)
    {
        var failure = FailList?.Invoke(prefix);
        if (failure is not null)
            throw failure;

        IReadOnlyList<BlobItem> items = _objects
            .Where(pair => pair.Key.StartsWith(prefix, StringComparison.Ordinal))
            .OrderBy(pair => pair.Value.Sequence)
            .Select(pair => new BlobItem(
                pair.Key,
                pair.Value.Content.Length,
                pair.Value.ContentType,
                pair.Value.UploadedAt))
            .ToList();

        return Task.FromResult(items);
    }

    public Task<IReadOnlyList<string>> GetPermittedBucketNamesAsync(
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<string>>(new[] { "fake-bucket" });

    public byte[] BytesAt(string objectKey) =>
        _objects.TryGetValue(objectKey, out var stored)
            ? stored.Content
            : throw new KeyNotFoundException(
                $"Nothing is stored at '{objectKey}'. The bucket holds: " +
                (_objects.Count == 0 ? "nothing" : string.Join(", ", _objects.Keys)));

    public IReadOnlyList<string> KeysUnder(string prefix) =>
        _objects
            .Where(pair => pair.Key.StartsWith(prefix, StringComparison.Ordinal))
            .OrderBy(pair => pair.Value.Sequence)
            .Select(pair => pair.Key)
            .ToList();

    public string SingleKeyUnder(string prefix)
    {
        var keys = KeysUnder(prefix);

        return keys.Count == 1
            ? keys[0]
            : throw new InvalidOperationException(
                $"Expected exactly one object under '{prefix}', found {keys.Count}.");
    }
}
