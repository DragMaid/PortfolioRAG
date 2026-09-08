using Backend.Models.Entities;
using Backend.Services;
using FileSignatures;

namespace Backend.Tests;

/// <summary>
/// What may be embedded in a post is decided by the bytes and nothing else. The filename
/// and the declared content type both come from whoever is uploading, so a check that
/// consulted either would be no check at all.
/// </summary>
public class MediaTypeDetectionTests
{
    private static readonly IMediaTypeDetector Detector =
        new FileSignatureMediaTypeDetector(new FileFormatInspector());

    private static MediaExtension? Detect(byte[] content) =>
        Detector.Detect(new MemoryStream(content));

    [Fact]
    public void A_png_is_recognised_from_its_bytes() =>
        Assert.Equal(MediaExtension.Png, Detect(TestFiles.Png()));

    [Fact]
    public void A_jpeg_is_recognised_from_its_bytes() =>
        Assert.Equal(MediaExtension.Jpeg, Detect(TestFiles.Jpeg()));

    [Fact]
    public void A_gif_is_recognised_from_its_bytes() =>
        Assert.Equal(MediaExtension.Gif, Detect(TestFiles.Gif()));

    [Fact]
    public void A_webp_is_recognised_from_its_bytes() =>
        Assert.Equal(MediaExtension.Webp, Detect(TestFiles.Webp()));

    [Fact]
    public void An_mp4_is_recognised_from_its_ftyp_box() =>
        Assert.Equal(MediaExtension.Mp4, Detect(TestFiles.Mp4()));

    [Fact]
    public void A_webm_is_recognised_from_its_ebml_doctype() =>
        Assert.Equal(MediaExtension.Webm, Detect(TestFiles.Webm()));

    [Fact]
    public void A_matroska_file_is_not_a_webm()
    {
        // The hand-rolled detector this replaced matched the four EBML magic bytes, which
        // Matroska and WebM share, and stored .mkv as video/webm for a browser that cannot
        // play it. Telling them apart means reading the DocType.
        Assert.Null(Detect(TestFiles.Matroska()));
    }

    [Fact]
    public void A_png_renamed_as_a_video_is_still_a_png()
    {
        // The name never reaches the detector; this is here to say so out loud.
        Assert.Equal(MediaExtension.Png, Detect(TestFiles.Png()));
    }

    [Fact]
    public void Plain_text_is_not_media() =>
        Assert.Null(Detect(TestFiles.NotMedia()));

    [Fact]
    public void An_svg_document_is_no_longer_media()
    {
        // SVG is markup that can carry script. It was dropped along with the hand-written
        // text sniffing that was the only way to recognise it.
        Assert.Null(Detect(TestFiles.Svg()));
    }

    [Fact]
    public void An_empty_stream_is_not_media() =>
        Assert.Null(Detect([]));

    [Fact]
    public void Detection_leaves_the_stream_rewound()
    {
        // MediaService hands the same stream to the optimizer next, so a detector that
        // consumed it would leave nothing to encode.
        var content = new MemoryStream(TestFiles.Png());

        Detector.Detect(content);

        Assert.Equal(0, content.Position);
    }

    [Fact]
    public void A_non_seekable_stream_is_refused()
    {
        // Signatures sit at different offsets and one format is settled by reading into the
        // body, so the stream has to be rewindable. Better a loud failure than a miss.
        using var underlying = new MemoryStream(TestFiles.Png());
        using var forwardOnly = new ForwardOnlyStream(underlying);

        Assert.Throws<NotSupportedException>(() => Detector.Detect(forwardOnly));
    }

    private sealed class ForwardOnlyStream(Stream inner) : Stream
    {
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }
        public override int Read(byte[] buffer, int offset, int count) => inner.Read(buffer, offset, count);
        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
