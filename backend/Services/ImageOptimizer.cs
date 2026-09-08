using Backend.Common.Exceptions;
using Backend.Common.Options;
using Backend.Models.Entities;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace Backend.Services;

/// <summary>
/// Normalizes every picture that reaches the bucket: oriented, scaled to something a blog
/// page can actually use, re-encoded as WebP and stripped of metadata.
/// </summary>
public class ImageOptimizer : IImageOptimizer
{
    private readonly MediaOptions _options;
    private readonly ILogger<ImageOptimizer> _logger;

    public ImageOptimizer(IOptions<MediaOptions> options, ILogger<ImageOptimizer> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<OptimizedImage?> OptimizeAsync(
        Stream source,
        int maxDimension,
        CancellationToken cancellationToken = default)
    {
        source.Position = 0;

        ImageInfo info;

        try
        {
            info = await Image.IdentifyAsync(source, cancellationToken);
        }
        catch (UnknownImageFormatException exception)
        {
            throw new UnsupportedMediaTypeException(
                "The upload could not be read as a picture. " + exception.Message);
        }
        catch (InvalidImageContentException exception)
        {
            throw new UnsupportedMediaTypeException(
                "The picture is malformed and could not be decoded. " + exception.Message);
        }

        var pixels = (long)info.Width * info.Height;

        if (pixels > _options.MaxImagePixels)
        {
            throw new PayloadTooLargeException(
                $"The picture is {info.Width}x{info.Height} ({pixels:N0} pixels), over the " +
                $"{_options.MaxImagePixels:N0} pixel limit.");
        }

        source.Position = 0;

        // NOTE: avoid sending an image with thousands of frames (GIF)
        var decoderOptions = new DecoderOptions
        {
            MaxFrames = MaxFrames
        };

        using var image = await Image.LoadAsync(decoderOptions, source, cancellationToken);

        var needsResize = Math.Max(image.Width, image.Height) > maxDimension;

        image.Mutate(context =>
        {
            // NOTE: this read EXIF orientation and rotate/flip the pixels accordingly
            context.AutoOrient();

            // Resize to max dimension allowed
            if (needsResize)
            {
                context.Resize(new ResizeOptions
                {
                    // Max keeps the aspect ratio and never scales up.
                    Mode = ResizeMode.Max,
                    Size = new Size(maxDimension, maxDimension)
                });
            }
        });


        // TODO: Strips EXIF, XMP and ICC metadata also
        var encoder = new WebpEncoder
        {
            Quality = _options.ImageQuality,
            FileFormat = WebpFileFormatType.Lossy,
            SkipMetadata = true
        };

        var buffer = new MemoryStream();

        try
        {
            await image.SaveAsync(buffer, encoder, cancellationToken);
        }
        catch
        {
            await buffer.DisposeAsync();
            throw;
        }

        // NOTE: in case after compression the image turned out worse (more space), we return null
        if (!needsResize && buffer.Length >= source.Length * _options.MinimumCompressionRatio)
        {
            _logger.LogDebug(
                "Keeping the uploaded picture as-is: WebP came out at {OptimizedBytes} bytes against {OriginalBytes}.",
                buffer.Length,
                source.Length);

            await buffer.DisposeAsync();
            return null;
        }

        _logger.LogDebug(
            "Optimized a {OriginalWidth}x{OriginalHeight} picture to {Width}x{Height} WebP, {OriginalBytes} -> {OptimizedBytes} bytes.",
            info.Width,
            info.Height,
            image.Width,
            image.Height,
            source.Length,
            buffer.Length);

        buffer.Position = 0;

        return new OptimizedImage
        {
            Content = buffer,
            Extension = MediaExtension.Webp,
            Width = image.Width,
            Height = image.Height
        };
    }

    private const int MaxFrames = 600;
}
