using Backend.Common.Exceptions;
using Backend.Common.Options;
using Backend.Models.Entities;
using Backend.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;

namespace Backend.Tests;

/// <summary>
/// Every picture that reaches the bucket is normalized on the way in: oriented, scaled to
/// something a blog page can use, re-encoded, and stripped of the metadata a camera left
/// behind. The guards here are as much about what a hostile upload can cost as about size.
/// </summary>
public class ImageOptimizerTests
{
    private static ImageOptimizer Optimizer(Action<MediaOptions>? configure = null)
    {
        var options = new MediaOptions();
        configure?.Invoke(options);

        return new ImageOptimizer(Options.Create(options), NullLogger<ImageOptimizer>.Instance);
    }

    [Fact]
    public async Task An_oversized_picture_is_scaled_down_to_the_long_edge()
    {
        var optimizer = Optimizer();

        using var result = await optimizer.OptimizeAsync(new MemoryStream(TestFiles.Png(900, 300)), 256);

        Assert.NotNull(result);
        Assert.Equal(256, result.Width);
        // The aspect ratio is kept: 900x300 is 3:1, so the short edge follows.
        Assert.Equal(85, result.Height);
    }

    [Fact]
    public async Task An_optimized_picture_comes_back_as_webp()
    {
        var optimizer = Optimizer();

        using var result = await optimizer.OptimizeAsync(new MemoryStream(TestFiles.Jpeg(900, 300)), 256);

        Assert.NotNull(result);
        Assert.Equal(MediaExtension.Webp, result.Extension);

        // Assert on the format rather than its display name, which is only a label.
        Assert.IsType<WebpFormat>(await Image.DetectFormatAsync(result.Content));
    }

    [Fact]
    public async Task A_picture_within_the_dimension_limit_is_not_scaled_up()
    {
        var optimizer = Optimizer();

        using var result = await optimizer.OptimizeAsync(new MemoryStream(TestFiles.Png(64, 48, noisy: true)), 2048);

        Assert.NotNull(result);
        Assert.Equal(64, result.Width);
        Assert.Equal(48, result.Height);
    }

    [Fact]
    public async Task Re_encoding_is_declined_when_it_would_not_save_space()
    {
        // Nothing needed resizing, so the only reason to re-encode was to save bytes. With
        // the bar set this high it cannot, and the upload is better off stored as it came.
        var optimizer = Optimizer(options => options.MinimumCompressionRatio = 0.0001);

        var result = await optimizer.OptimizeAsync(new MemoryStream(TestFiles.Png(32, 32)), 2048);

        Assert.Null(result);
    }

    [Fact]
    public async Task Metadata_is_stripped_from_the_re_encoded_picture()
    {
        // This is a privacy property, not a size one: EXIF is where the camera, the owner's
        // name and the GPS coordinates of a photograph live.
        var optimizer = Optimizer();

        using var result = await optimizer.OptimizeAsync(new MemoryStream(TestFiles.JpegWithExif(900, 300)), 256);

        Assert.NotNull(result);

        using var stored = await Image.LoadAsync(result.Content);
        Assert.Null(stored.Metadata.ExifProfile);
    }

    [Fact]
    public async Task A_picture_over_the_pixel_budget_is_refused()
    {
        // A tiny file can claim enormous dimensions, so the byte limit upstream does not
        // catch this. The header alone reports the size, and that is all this reads.
        var optimizer = Optimizer(options => options.MaxImagePixels = 100);

        await Assert.ThrowsAsync<PayloadTooLargeException>(() =>
            optimizer.OptimizeAsync(new MemoryStream(TestFiles.Png(64, 64)), 2048));
    }

    [Fact]
    public async Task Bytes_that_are_not_a_picture_are_refused()
    {
        var optimizer = Optimizer();

        await Assert.ThrowsAsync<UnsupportedMediaTypeException>(() =>
            optimizer.OptimizeAsync(new MemoryStream(TestFiles.NotMedia()), 2048));
    }

    [Fact]
    public async Task A_truncated_picture_is_refused()
    {
        // The header is intact and the dimensions read fine; the failure only surfaces when
        // the pixels are decoded, and it still has to come back as a 415 rather than a 500.
        var optimizer = Optimizer();

        await Assert.ThrowsAsync<UnsupportedMediaTypeException>(() =>
            optimizer.OptimizeAsync(new MemoryStream(TestFiles.TruncatedPng()), 2048));
    }

    [Fact]
    public async Task The_returned_stream_is_positioned_at_the_start()
    {
        // It is handed straight to the upload, which would otherwise store nothing at all.
        var optimizer = Optimizer();

        using var result = await optimizer.OptimizeAsync(new MemoryStream(TestFiles.Png(900, 300)), 256);

        Assert.NotNull(result);
        Assert.Equal(0, result.Content.Position);
    }
}
