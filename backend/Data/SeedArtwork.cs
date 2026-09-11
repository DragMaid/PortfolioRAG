using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.PixelFormats;

namespace Backend.Data;

/// <summary>
/// This is so damn cool, instead of having to upload a real image, Im just generating
/// it here using deterministic codes that can then be seeded to generate variations.
/// </summary>
public static class SeedArtwork
{
    public static MemoryStream Thumbnail(int variant) => Render(variant, 1200, 750, bars: 3);

    public static MemoryStream Trailer(int variant) => Render(variant + 3, 1280, 720, bars: 5);

    private static MemoryStream Render(int variant, int width, int height, int bars)
    {
        // A fixed palette rather than a random one: the same seed has to produce the same
        // pictures every time, or every reseed churns the bucket for no reason.
        var hue = (variant * 47) % 360;
        var ground = FromHsl(hue, 0.12f, 0.93f);
        var ink = FromHsl(hue, 0.55f, 0.32f);
        var accent = FromHsl((hue + 28) % 360, 0.62f, 0.52f);

        using var image = new Image<Rgba32>(width, height, ground);

        var barWidth = width / (bars * 2 + 1);
        var baseline = (int)(height * 0.72f);

        for (var i = 0; i < bars; i++)
        {
            // Bars that grow taller to the right
            var barHeight = (int)(height * (0.20f + 0.11f * ((variant + i) % 4)));
            var x = barWidth * (i * 2 + 1);
            FillRect(image, x, baseline - barHeight, barWidth, barHeight, i % 2 == 0 ? ink : accent);
        }

        FillRect(
            image,
            barWidth,
            baseline + (int)(height * 0.04f),
            width - barWidth * 2,
            Math.Max(1, (int)(height * 0.012f)),
            ink);

        var buffer = new MemoryStream();
        image.Save(buffer, new WebpEncoder { Quality = 80 });
        buffer.Position = 0;
        return buffer;
    }

    private static void FillRect(Image<Rgba32> image, int left, int top, int width, int height, Rgba32 color)
    {
        // Get the 4 corners of the rect
        var x0 = Math.Max(0, left);
        var y0 = Math.Max(0, top);
        var x1 = Math.Min(image.Width, left + width);
        var y1 = Math.Min(image.Height, top + height);

        // Gives all pixel rows in the image
        image.ProcessPixelRows(accessor =>
        {
            for (var y = y0; y < y1; y++)
            {
                var row = accessor.GetRowSpan(y);

                for (var x = x0; x < x1; x++)
                    row[x] = color;
            }
        });
    }

    /// <summary>HSL is the readable way to space a palette evenly; ImageSharp wants RGB.</summary>
    private static Rgba32 FromHsl(float hue, float saturation, float lightness)
    {
        var c = (1 - MathF.Abs(2 * lightness - 1)) * saturation;
        var x = c * (1 - MathF.Abs(hue / 60f % 2 - 1));
        var m = lightness - c / 2;

        // This divide the hue into 6 regions, to map it to a value
        var (r, g, b) = hue switch
        {
            < 60 => (c, x, 0f),
            < 120 => (x, c, 0f),
            < 180 => (0f, c, x),
            < 240 => (0f, x, c),
            < 300 => (x, 0f, c),
            _ => (c, 0f, x)
        };

        return new Rgba32(r + m, g + m, b + m);
    }
}
