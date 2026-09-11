using Backend.Common;
using Backend.Common.Exceptions;
using Backend.Common.Options;
using Backend.Common.Security;
using Backend.Mapping;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;
using Microsoft.Extensions.Options;

namespace Backend.Services;

public class MediaService : IMediaService
{
    private readonly IMediaRepository _medias;
    private readonly IPostRepository _posts;
    private readonly IAuthorRepository _authors;
    private readonly IObjectStorage _storage;
    private readonly IImageOptimizer _optimizer;
    private readonly IMediaTypeDetector _detector;
    private readonly ICurrentUser _currentUser;
    private readonly TimeProvider _timeProvider;
    private readonly MediaOptions _options;
    private readonly ILogger<MediaService> _logger;

    /// <summary>How much of the uploaded name is kept as a hint inside the generated key.</summary>
    private const int KeyHintLength = 48;

    public MediaService(
        IMediaRepository medias,
        IPostRepository posts,
        IAuthorRepository authors,
        IObjectStorage storage,
        IImageOptimizer optimizer,
        IMediaTypeDetector detector,
        ICurrentUser currentUser,
        TimeProvider timeProvider,
        IOptions<MediaOptions> options,
        ILogger<MediaService> logger)
    {
        _medias = medias;
        _posts = posts;
        _authors = authors;
        _storage = storage;
        _optimizer = optimizer;
        _detector = detector;
        _currentUser = currentUser;
        _timeProvider = timeProvider;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<MediaDto> AddToPostAsync(
        int postId,
        IFormFile file,
        MediaRole role = MediaRole.Attachment,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();

        var post = await _posts.GetByIdAsync(postId, tracked: false, cancellationToken)
            ?? throw NotFoundException.For("Post", postId);

        if (post.AuthorId != authorId)
            throw ForbiddenException.For("post", postId);

        // NOTE: a thumbnail is drawn as a still in a card and nothing ever plays it, so a
        // video in that slot would render as a dead frame. A trailer takes either — a
        // project with no footage is better served by a second picture than an empty player.
        using var upload = await ReadUploadAsync(
            file,
            _options.MaxImageDimension,
            allowVideo: role != MediaRole.Thumbnail,
            cancellationToken);

        var objectKey = BuildObjectKey(
            $"authors/{authorId}/posts/{postId}",
            file.FileName,
            upload.Extension);

        var stored = await _storage.UploadAsync(
            upload.Content,
            objectKey,
            upload.Extension.ToContentType(),
            cancellationToken);

        var media = new Media
        {
            Filename = SanitizeFilename(file.FileName, upload.Extension),
            ObjectKey = stored.ObjectKey,
            ByteSize = stored.ByteSize,
            Extension = upload.Extension,
            Role = role,
            PostId = postId,
            CreatedAt = _timeProvider.GetUtcNow()
        };

        // A post leads with one thumbnail and one trailer, so uploading either replaces
        // what was there. Removed in the same transaction as the insert: a unique index
        // holds the rule, and leaving both rows in place for even a moment would trip it.
        var replaced = role == MediaRole.Attachment
            ? null
            : (await _medias.GetByPostIdAsync(postId, cancellationToken))
                .FirstOrDefault(item => item.Role == role);

        try
        {
            if (replaced is not null)
                _medias.Remove(await _medias.GetByIdAsync(replaced.Id, tracked: true, cancellationToken) ?? replaced);

            await _medias.AddAsync(media, cancellationToken);
            await _medias.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // NOTE: the object is already in the bucket at this point. Without this the row
            // that would have pointed at it is gone and nothing will ever name that key
            // again — an invisible object on a bill that only ever grows.
            await TryDeleteObjectAsync(stored.ObjectKey, cancellationToken);
            throw;
        }

        // Best effort, as with an avatar: the post already points at the new file, so a
        // bucket that will not let go of the old one leaves a stray object, not a failure.
        if (replaced is not null)
            await TryDeleteObjectAsync(replaced.ObjectKey, cancellationToken);

        _logger.LogDebug(
            "Attached {ObjectKey} to post {PostId} as {Role} for author {AuthorId}.",
            stored.ObjectKey,
            postId,
            role,
            authorId);

        return media.ToDto();
    }

    public async Task<IReadOnlyList<MediaDto>> GetForPostAsync(
        int postId,
        CancellationToken cancellationToken = default)
    {
        var post = await _posts.GetByIdAsync(postId, tracked: false, cancellationToken)
            ?? throw NotFoundException.For("Post", postId);

        if (post.AuthorId != _currentUser.RequireAuthorId())
            throw ForbiddenException.For("post", postId);

        var medias = await _medias.GetByPostIdAsync(postId, cancellationToken);
        return medias.Select(m => m.ToDto()).ToList();
    }

    public async Task<IReadOnlyList<MediaDto>> GetForPublicPostAsync(
        string slug,
        CancellationToken cancellationToken = default)
    {
        var normalized = slug.Trim().ToLowerInvariant();

        var post = await _posts.GetBySlugAsync(normalized, tracked: false, cancellationToken);

        if (post is null || post.IsDraft)
            throw NotFoundException.For("Post", slug);

        var medias = await _medias.GetByPostIdAsync(post.Id, cancellationToken);
        return medias.Select(m => m.ToDto()).ToList();
    }

    public async Task<MediaDto> UpdateAsync(
        int postId,
        int mediaId,
        UpdateMediaDto dto,
        CancellationToken cancellationToken = default)
    {
        var media = await LoadOwnedAsync(postId, mediaId, cancellationToken);

        media.Caption = string.IsNullOrWhiteSpace(dto.Caption) ? null : dto.Caption.Trim();

        await _medias.SaveChangesAsync(cancellationToken);
        return media.ToDto();
    }

    public async Task DeleteAsync(int postId, int mediaId, CancellationToken cancellationToken = default)
    {
        var media = await LoadOwnedAsync(postId, mediaId, cancellationToken);

        // NOTE: the same rule that gates publishing, held from the other side. Publishing
        // requires a thumbnail and a trailer; letting one be deleted afterwards would leave
        // a live project with a hole in it that nothing would ever flag. Unpublish first.
        if (media.Role != MediaRole.Attachment && !media.Post.IsDraft)
        {
            throw new ValidationException(
                $"A published project must keep its {media.Role.ToString().ToLowerInvariant()}. " +
                "Upload a replacement to swap it, or unpublish the project first.");
        }

        // NOTE: bucket first. If it fails the row survives and the delete can be retried;
        // the other order would leave an object nothing remembers the key of.
        await _storage.DeleteAsync(media.ObjectKey, cancellationToken);

        _medias.Remove(media);
        await _medias.SaveChangesAsync(cancellationToken);
    }

    public async Task<Uri> GetContentUrlAsync(int mediaId, CancellationToken cancellationToken = default)
    {
        var media = await _medias.GetByIdAsync(mediaId, tracked: false, cancellationToken)
            ?? throw NotFoundException.For("Media", mediaId);

        // NOTE: a draft's media is a 404 rather than a 403 — the same answer an id that
        // never existed gets. A 403 would confirm to a stranger that an unpublished post
        // holds a picture at this id, which is exactly what a draft is meant not to say.
        if (media.Post.IsDraft && media.Post.AuthorId != _currentUser.AuthorId)
            throw NotFoundException.For("Media", mediaId);

        return await _storage.GetDownloadUrlAsync(media.ObjectKey, cancellationToken);
    }

    public async Task<AuthorDto> SetAvatarAsync(IFormFile file, CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();

        var author = await _authors.GetByIdAsync(authorId, tracked: true, cancellationToken)
            ?? throw new UnauthorizedException("The signed-in account no longer exists.");

        using var upload = await ReadUploadAsync(
            file,
            _options.MaxAvatarDimension,
            allowVideo: false,
            cancellationToken);

        var objectKey = BuildObjectKey($"authors/{authorId}/avatar", file.FileName, upload.Extension);

        var stored = await _storage.UploadAsync(
            upload.Content,
            objectKey,
            upload.Extension.ToContentType(),
            cancellationToken);

        var replaced = author.AvatarObjectKey;
        author.AvatarObjectKey = stored.ObjectKey;

        try
        {
            await _authors.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await TryDeleteObjectAsync(stored.ObjectKey, cancellationToken);
            throw;
        }

        // Best effort: the profile already points at the new avatar, so a bucket that
        // refuses to let go of the old one is a stray object, not a failed request.
        if (replaced is not null)
            await TryDeleteObjectAsync(replaced, cancellationToken);

        return author.ToDto();
    }

    public async Task<AuthorDto> RemoveAvatarAsync(CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();

        var author = await _authors.GetByIdAsync(authorId, tracked: true, cancellationToken)
            ?? throw new UnauthorizedException("The signed-in account no longer exists.");

        var objectKey = author.AvatarObjectKey;

        if (objectKey is null)
            return author.ToDto();

        await _storage.DeleteAsync(objectKey, cancellationToken);

        author.AvatarObjectKey = null;
        await _authors.SaveChangesAsync(cancellationToken);

        return author.ToDto();
    }

    public async Task<Uri> GetAvatarUrlAsync(int authorId, CancellationToken cancellationToken = default)
    {
        var author = await _authors.GetByIdAsync(authorId, tracked: false, cancellationToken)
            ?? throw NotFoundException.For("Author", authorId);

        if (author.AvatarObjectKey is null)
            throw NotFoundException.For("Avatar", authorId);

        return await _storage.GetDownloadUrlAsync(author.AvatarObjectKey, cancellationToken);
    }

    public async Task<ExperienceDto> SetExperienceLogoAsync(
        int experienceId,
        IFormFile file,
        CancellationToken cancellationToken = default)
    {
        var experience = await LoadOwnExperienceAsync(experienceId, cancellationToken);

        using var upload = await ReadUploadAsync(
            file,
            _options.MaxAvatarDimension,
            allowVideo: false,
            cancellationToken);

        var objectKey = BuildObjectKey(
            $"authors/{experience.AuthorId}/experiences/{experienceId}",
            file.FileName,
            upload.Extension);

        var stored = await _storage.UploadAsync(
            upload.Content,
            objectKey,
            upload.Extension.ToContentType(),
            cancellationToken);

        var replaced = experience.LogoObjectKey;
        experience.LogoObjectKey = stored.ObjectKey;

        try
        {
            await _authors.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await TryDeleteObjectAsync(stored.ObjectKey, cancellationToken);
            throw;
        }

        // Best effort, as with an avatar: the row already points at the new mark, so a
        // bucket that will not let go of the old one leaves a stray object, not a failure.
        if (replaced is not null)
            await TryDeleteObjectAsync(replaced, cancellationToken);

        return experience.ToDto();
    }

    public async Task<ExperienceDto> RemoveExperienceLogoAsync(
        int experienceId,
        CancellationToken cancellationToken = default)
    {
        var experience = await LoadOwnExperienceAsync(experienceId, cancellationToken);
        var objectKey = experience.LogoObjectKey;

        if (objectKey is null)
            return experience.ToDto();

        await _storage.DeleteAsync(objectKey, cancellationToken);

        experience.LogoObjectKey = null;
        await _authors.SaveChangesAsync(cancellationToken);

        return experience.ToDto();
    }

    public async Task<Uri> GetExperienceLogoUrlAsync(
        int experienceId,
        CancellationToken cancellationToken = default)
    {
        var experience = await _authors.GetExperienceAsync(experienceId, tracked: false, cancellationToken)
            ?? throw NotFoundException.For("Experience", experienceId);

        if (experience.LogoObjectKey is null)
            throw NotFoundException.For("Logo", experienceId);

        return await _storage.GetDownloadUrlAsync(experience.LogoObjectKey, cancellationToken);
    }

    public Task PurgeExperienceObjectsAsync(
        int experienceId,
        int authorId,
        CancellationToken cancellationToken = default) =>
        PurgePrefixAsync($"authors/{authorId}/experiences/{experienceId}/", cancellationToken);

    public Task PurgePostObjectsAsync(
        int postId,
        int authorId,
        CancellationToken cancellationToken = default) =>
        PurgePrefixAsync($"authors/{authorId}/posts/{postId}/", cancellationToken);

    public Task PurgeAuthorObjectsAsync(int authorId, CancellationToken cancellationToken = default) =>
        PurgePrefixAsync($"authors/{authorId}/", cancellationToken);

    /// <summary>
    /// Empties one folder of the bucket. Deliberately best effort: it runs as a post or an
    /// account is being deleted, and a storage outage must not be able to keep somebody's
    /// account open. What survives is a logged, addressable prefix rather than silence.
    /// </summary>
    private async Task<Experience> LoadOwnExperienceAsync(int experienceId, CancellationToken cancellationToken)
    {
        var experience = await _authors.GetExperienceAsync(experienceId, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Experience", experienceId);

        if (experience.AuthorId != _currentUser.RequireAuthorId())
            throw ForbiddenException.For("experience", experienceId);

        return experience;
    }

    private async Task<Media> LoadOwnedAsync(
        int postId,
        int mediaId,
        CancellationToken cancellationToken)
    {
        var media = await _medias.GetByIdAsync(mediaId, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Media", mediaId);

        if (media.PostId != postId)
            throw NotFoundException.For("Media", mediaId);

        if (media.Post.AuthorId != _currentUser.RequireAuthorId())
            throw ForbiddenException.For("media", mediaId);

        return media;
    }

    private async Task PurgePrefixAsync(string prefix, CancellationToken cancellationToken)
    {
        try
        {
            // NOTE: driven off the bucket rather than off the media rows, so an object whose
            // row was already lost is still swept up.
            var objects = await _storage.ListAsync(prefix, cancellationToken);

            foreach (var item in objects)
            {
                await _storage.DeleteAsync(item.ObjectKey, cancellationToken);
            }

            if (objects.Count > 0)
                _logger.LogInformation("Purged {ObjectCount} object(s) under {Prefix}.", objects.Count, prefix);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogError(
                exception,
                "Could not purge objects under {Prefix}. They are now orphaned and need clearing by hand.",
                prefix);
        }
    }

    private async Task TryDeleteObjectAsync(string objectKey, CancellationToken cancellationToken)
    {
        try
        {
            await _storage.DeleteAsync(objectKey, cancellationToken);
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "Could not remove {ObjectKey} after the operation that stored it failed. It is now orphaned.",
                objectKey);
        }
    }

    /// <summary>
    /// Buffers an upload, works out what it actually is, holds it to the configured limits
    /// and hands back what should be stored.
    /// </summary>
    private async Task<UploadedContent> ReadUploadAsync(
        IFormFile file,
        int maxDimension,
        bool allowVideo,
        CancellationToken cancellationToken)
    {
        if (file.Length == 0)
            throw new ValidationException("The uploaded file is empty.");

        // NOTE: the ceiling checked here is the largest this endpoint could accept, so an
        // oversized body is turned away before anything is read. An avatar cannot be a
        // video, so it is held to the picture limit rather than the video one — otherwise
        // a 100 MB file would be buffered in full only to be rejected for its type.
        var ceiling = allowVideo ? _options.MaxUploadBytes : _options.MaxImageBytes;

        if (file.Length > ceiling)
            throw PayloadTooLargeException.For("upload", file.Length, ceiling);

        var source = file.OpenReadStream();
        Stream content = source;

        try
        {
            if (!content.CanSeek)
            {
                // A form part small enough to stay in memory is seekable; this is the
                // fallback for hosts that stream it straight through.
                var buffer = new MemoryStream(checked((int)file.Length));
                await content.CopyToAsync(buffer, cancellationToken);
                await content.DisposeAsync();
                content = buffer;
            }

            var extension = DetectExtension(content);

            if (extension.IsVideo() && !allowVideo)
                throw new UnsupportedMediaTypeException("This slot has to be a picture, not a video.");

            var limit = extension.IsVideo() ? _options.MaxVideoBytes : _options.MaxImageBytes;

            if (file.Length > limit)
                throw PayloadTooLargeException.For(extension.ToContentType(), file.Length, limit);

            if (!extension.IsRaster())
            {
                // Video is stored exactly as it arrived — already compressed, and nothing
                // here is going to re-encode it better. It was still identified from its
                // bytes rather than from what the upload claimed to be.
                content.Position = 0;
                return new UploadedContent(content, extension, ownsStream: true);
            }

            var optimized = await _optimizer.OptimizeAsync(content, maxDimension, cancellationToken);

            if (optimized is null)
            {
                content.Position = 0;
                return new UploadedContent(content, extension, ownsStream: true);
            }

            await content.DisposeAsync();
            return new UploadedContent(optimized.Content, optimized.Extension, ownsStream: true);
        }
        catch
        {
            await content.DisposeAsync();
            throw;
        }
    }

    private MediaExtension DetectExtension(Stream content) =>
        _detector.Detect(content)
            ?? throw new UnsupportedMediaTypeException(
                "That file type cannot be embedded in a post. " +
                "Accepted: PNG, JPEG, GIF, WebP, MP4 and WebM.");

    /// <summary>
    /// Builds the key an object is stored under. The uploaded name never becomes the key:
    /// it is attacker-controlled, may collide with another author's file, and can carry
    /// path separators. What goes in is a random token, plus a slug of the original as a
    /// readable hint for anyone looking at the bucket.
    /// </summary>
    private static string BuildObjectKey(string folder, string originalFilename, MediaExtension extension)
    {
        var hint = SlugGenerator.Generate(Path.GetFileNameWithoutExtension(originalFilename ?? string.Empty));

        if (hint.Length > KeyHintLength)
            hint = hint[..KeyHintLength].TrimEnd('-');

        var token = Guid.NewGuid().ToString("N");
        var name = string.IsNullOrEmpty(hint) ? token : $"{token}-{hint}";

        return $"{folder}/{name}{extension.ToFileExtension()}";
    }

    /// <summary>
    /// The name shown back to the author. Only the leaf of whatever path the client sent,
    /// re-extended to match what was actually stored after optimization.
    /// </summary>
    private static string SanitizeFilename(string originalFilename, MediaExtension extension)
    {
        // NOTE: Path.GetFileName only strips the separators this platform knows about, and
        // a browser on the other one sends its own; both are dropped explicitly.
        var leaf = (originalFilename ?? string.Empty)
            .Replace('\\', '/')
            .Split('/')
            .LastOrDefault() ?? string.Empty;

        var stem = Path.GetFileNameWithoutExtension(leaf).Trim();

        if (string.IsNullOrWhiteSpace(stem))
            stem = "upload";

        var suffix = extension.ToFileExtension();
        const int maxLength = 100;

        if (stem.Length + suffix.Length > maxLength)
            stem = stem[..(maxLength - suffix.Length)];

        return stem + suffix;
    }

    /// <summary>What is about to be stored, once the upload has been identified and optimized.</summary>
    private sealed class UploadedContent : IDisposable
    {
        private readonly bool _ownsStream;

        public UploadedContent(Stream content, MediaExtension extension, bool ownsStream)
        {
            Content = content;
            Extension = extension;
            _ownsStream = ownsStream;
        }

        public Stream Content { get; }

        public MediaExtension Extension { get; }

        public void Dispose()
        {
            if (_ownsStream)
                Content.Dispose();
        }
    }
}
