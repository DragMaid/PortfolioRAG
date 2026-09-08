namespace Backend.Common.Options;

/// <summary>
/// What the upload endpoints accept and what happens to an image on the way in. Separate
/// from <see cref="BackblazeOptions"/> because none of it is about the storage provider —
/// the same limits would apply on top of any bucket.
/// </summary>
public class MediaOptions
{
    public const string SectionName = "Media";

    /// <summary>
    /// Ceiling on the bytes an author may send for a picture. Enforced before anything is
    /// decoded, so a decompression bomb never reaches ImageSharp.
    /// </summary>
    public long MaxImageBytes { get; set; } = 10L * 1024 * 1024;  // 10Mb

    public long MaxVideoBytes { get; set; } = 100L * 1024 * 1024;  // 100 Mb

    /// <summary>
    /// Total pixels a picture may decode to. A 20KB PNG can claim 50,000 x 50,000 and cost
    /// gigabytes to decode, which the byte limit alone does not catch. This attack method I
    /// learnt from youtube once so best avoid it
    /// </summary>
    public long MaxImagePixels { get; set; } = 50_000_000;

    /// <summary>Long edge an uploaded picture is scaled down to. Never scaled up.</summary>
    public int MaxImageDimension { get; set; } = 2048;

    /// <summary>Long edge for an avatar, which is only ever shown small.</summary>
    public int MaxAvatarDimension { get; set; } = 512;

    /// <summary>WebP quality, 1-100. 80 is the usual "no visible loss" mark.</summary>
    public int ImageQuality { get; set; } = 80;

    /// <summary>If the compression process doesn't reduce that much space then skipped</summary>
    public double MinimumCompressionRatio { get; set; } = 0.95;

    /// <summary>The largest body either upload endpoint could legitimately carry.</summary>
    public long MaxUploadBytes => Math.Max(MaxImageBytes, MaxVideoBytes);

    public void Validate()
    {
        if (MaxImageBytes <= 0 || MaxVideoBytes <= 0 || MaxImagePixels <= 0)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}': MaxImageBytes, MaxVideoBytes and MaxImagePixels must be positive.");
        }

        if (MaxImageDimension <= 0 || MaxAvatarDimension <= 0)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}': MaxImageDimension and MaxAvatarDimension must be positive.");
        }

        if (ImageQuality is < 1 or > 100)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:{nameof(ImageQuality)}' must be between 1 and 100.");
        }

        if (MinimumCompressionRatio is <= 0 or > 1)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:{nameof(MinimumCompressionRatio)}' must be greater than 0 and at most 1.");
        }
    }
}
