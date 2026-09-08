using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Metadata.Profiles.Exif;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.PixelFormats;

namespace Backend.Tests;

/// <summary>
/// Bodies to upload. The pictures are real, encoded by the same library the service decodes
/// them with; the two video headers are hand-built because nothing here needs a playable
/// film, only a container the detector can name.
/// </summary>
public static class TestFiles
{
    /// <summary>An upload as the multipart binder would hand it to a controller.</summary>
    public static IFormFile FormFile(
        byte[] content,
        string filename,
        string contentType = "application/octet-stream")
    {
        var stream = new MemoryStream(content, writable: false);

        return new FormFile(stream, 0, content.Length, name: "file", fileName: filename)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    public static byte[] Png(int width = 32, int height = 32, bool noisy = false) =>
        Encode(width, height, noisy, new PngEncoder());

    public static byte[] Jpeg(int width = 32, int height = 32, bool noisy = false, int quality = 90) =>
        Encode(width, height, noisy, new JpegEncoder { Quality = quality });

    public static byte[] Gif(int width = 32, int height = 32) =>
        Encode(width, height, noisy: false, new GifEncoder());

    public static byte[] Webp(int width = 32, int height = 32, int quality = 80) =>
        Encode(width, height, noisy: false, new WebpEncoder { Quality = quality });

    /// <summary>
    /// A bare ISO base media <c>ftyp</c> box — the first 32 bytes of any MP4. Enough for a
    /// signature to match, which is all the service ever looks at for a video.
    /// </summary>
    public static byte[] Mp4() =>
    [
        0x00, 0x00, 0x00, 0x20,                          // box size: 32
        0x66, 0x74, 0x79, 0x70,                          // 'ftyp'
        0x69, 0x73, 0x6F, 0x6D,                          // major brand 'isom'
        0x00, 0x00, 0x02, 0x00,                          // minor version
        0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,  // compatible: isom, iso2
        0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31   // compatible: avc1, mp41
    ];

    /// <summary>
    /// An EBML header declaring DocType "webm". The four magic bytes alone are not enough:
    /// Matroska shares them, and the detector reads the DocType to tell them apart.
    /// </summary>
    public static byte[] Webm() => Ebml("webm");

    /// <summary>
    /// The same container with DocType "matroska". It must be refused — the hand-rolled
    /// detector this replaced matched the magic bytes and stored .mkv as video/webm.
    /// </summary>
    public static byte[] Matroska() => Ebml("matroska");

    /// <summary>
    /// A JPEG carrying EXIF. Real photographs arrive with a metadata block that can hold
    /// the camera, the owner's name and the GPS coordinates of where it was taken.
    /// </summary>
    public static byte[] JpegWithExif(int width = 32, int height = 32)
    {
        using var image = new Image<Rgba32>(width, height);
        var exif = new ExifProfile();
        exif.SetValue(ExifTag.Orientation, (ushort)1);
        exif.SetValue(ExifTag.Copyright, "a test");
        image.Metadata.ExifProfile = exif;

        using var buffer = new MemoryStream();
        image.Save(buffer, new JpegEncoder { Quality = 90 });
        return buffer.ToArray();
    }

    public static byte[] Svg() =>
        "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"8\" height=\"8\"/>"u8
            .ToArray();

    public static byte[] NotMedia() => "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"u8.ToArray();

    public static byte[] TruncatedPng()
    {
        var png = Png(16, 16);
        return png[..(png.Length / 3)];
    }

    private static byte[] Encode(int width, int height, bool noisy, IImageEncoder encoder)
    {
        using var image = new Image<Rgba32>(width, height);

        if (noisy)
        {
            // A flat fill compresses to almost nothing, which makes "did re-encoding help?"
            // meaningless. Deterministic noise gives the encoder something to work on.
            var random = new Random(Seed: 1234);

            image.ProcessPixelRows(accessor =>
            {
                for (var y = 0; y < accessor.Height; y++)
                {
                    var row = accessor.GetRowSpan(y);

                    for (var x = 0; x < row.Length; x++)
                    {
                        row[x] = new Rgba32(
                            (byte)random.Next(256),
                            (byte)random.Next(256),
                            (byte)random.Next(256));
                    }
                }
            });
        }
        else
        {
            image.ProcessPixelRows(accessor =>
            {
                for (var y = 0; y < accessor.Height; y++)
                {
                    var row = accessor.GetRowSpan(y);

                    for (var x = 0; x < row.Length; x++)
                        row[x] = new Rgba32((byte)(x % 256), (byte)(y % 256), 0x80);
                }
            });
        }

        using var buffer = new MemoryStream();
        image.Save(buffer, encoder);
        return buffer.ToArray();
    }

    private static byte[] Ebml(string docType)
    {
        var docTypeBytes = System.Text.Encoding.ASCII.GetBytes(docType);

        // Every element is id + a one-byte size marked with 0x80 + payload. The header's own
        // size is everything after it, so it has to be counted rather than guessed.
        var elements = new List<byte>();
        elements.AddRange([0x42, 0x86, 0x81, 0x01]);                    // EBMLVersion = 1
        elements.AddRange([0x42, 0xF7, 0x81, 0x01]);                    // EBMLReadVersion = 1
        elements.AddRange([0x42, 0xF2, 0x81, 0x04]);                    // EBMLMaxIDLength = 4
        elements.AddRange([0x42, 0xF3, 0x81, 0x08]);                    // EBMLMaxSizeLength = 8
        elements.AddRange([0x42, 0x82, (byte)(0x80 | docTypeBytes.Length)]);
        elements.AddRange(docTypeBytes);                                // DocType
        elements.AddRange([0x42, 0x87, 0x81, 0x04]);                    // DocTypeVersion = 4
        elements.AddRange([0x42, 0x85, 0x81, 0x02]);                    // DocTypeReadVersion = 2

        var document = new List<byte> { 0x1A, 0x45, 0xDF, 0xA3, (byte)(0x80 | elements.Count) };
        document.AddRange(elements);

        // A trailing Segment element, so the file does not simply stop after its header.
        document.AddRange([0x18, 0x53, 0x80, 0x67, 0x84, 0x00, 0x00, 0x00, 0x00]);

        return document.ToArray();
    }
}
