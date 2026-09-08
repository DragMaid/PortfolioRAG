using Backend.Models.Entities;

namespace Backend.Services;

/// <summary>
/// The result of re-encoding an upload. The stream is a fresh buffer owned by the caller;
/// <see cref="Extension"/> is what the bytes now are, which is rarely what arrived.
/// </summary>
public sealed class OptimizedImage : IDisposable
{
    public required MemoryStream Content { get; init; }

    public required MediaExtension Extension { get; init; }

    public required int Width { get; init; }

    public required int Height { get; init; }

    public void Dispose() => Content.Dispose();
}

public interface IImageOptimizer
{
    /// <summary>
    /// Scales a picture down to <paramref name="maxDimension"/> on its long edge and
    /// re-encodes it, stripping metadata on the way through. Returns null when the original
    /// is already the better file — the caller should then store what it was given.
    /// </summary>
    /// <exception cref="Common.Exceptions.UnsupportedMediaTypeException">
    /// The bytes do not decode as a picture.
    /// </exception>
    /// <exception cref="Common.Exceptions.PayloadTooLargeException">
    /// The picture decodes to more pixels than the configured budget allows.
    /// </exception>
    Task<OptimizedImage?> OptimizeAsync(
        Stream source,
        int maxDimension,
        CancellationToken cancellationToken = default);
}
