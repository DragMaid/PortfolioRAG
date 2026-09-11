using Backend.Models.DTOs;

namespace Backend.Services;

/// <summary>
/// Everything that puts a file in front of a reader: what may be uploaded, what it is
/// turned into, who is allowed to see it, and what is removed from the bucket when the
/// thing it belonged to goes away.
/// </summary>
public interface IMediaService
{
    /// <summary>
    /// Attaches a file to one of the caller's own posts. The bytes are identified by content
    /// rather than by name, pictures are re-encoded, and the object is stored under a
    /// generated key — the uploaded filename is kept for display only.
    /// </summary>
    Task<MediaDto> AddToPostAsync(int postId, IFormFile file, CancellationToken cancellationToken = default);

    /// <summary>The media on one of the caller's own posts, draft or not.</summary>
    Task<IReadOnlyList<MediaDto>> GetForPostAsync(int postId, CancellationToken cancellationToken = default);

    /// <summary>The media on a published post. A draft is a 404 here, as everywhere public.</summary>
    Task<IReadOnlyList<MediaDto>> GetForPublicPostAsync(string slug, CancellationToken cancellationToken = default);

    /// <summary>
    /// Rewrites the caption on one item of the caller's own post. The only editable part of
    /// an upload — everything else about it is fixed by the bytes that arrived.
    /// </summary>
    Task<MediaDto> UpdateAsync(
        int postId,
        int mediaId,
        UpdateMediaDto dto,
        CancellationToken cancellationToken = default);

    /// <summary>Removes one item from the caller's own post, bucket object included.</summary>
    Task DeleteAsync(int postId, int mediaId, CancellationToken cancellationToken = default);

    /// <summary>
    /// A signed link to one item's content. Readable by anyone once the post is published,
    /// and by nobody but its author before that.
    /// </summary>
    Task<Uri> GetContentUrlAsync(int mediaId, CancellationToken cancellationToken = default);

    /// <summary>Replaces the caller's own avatar. Returns the profile as it now reads.</summary>
    Task<AuthorDto> SetAvatarAsync(IFormFile file, CancellationToken cancellationToken = default);

    /// <summary>Drops the caller's avatar. The account then has none until one is uploaded.</summary>
    Task<AuthorDto> RemoveAvatarAsync(CancellationToken cancellationToken = default);

    /// <summary>A signed link to an author's uploaded avatar. Public, like the profile it belongs to.</summary>
    Task<Uri> GetAvatarUrlAsync(int authorId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Replaces the company mark on one of the caller's own experiences. Scaled and
    /// re-encoded like an avatar, and a picture for the same reason: it is drawn at 24px
    /// inside a timeline node.
    /// </summary>
    Task<ExperienceDto> SetExperienceLogoAsync(
        int experienceId,
        IFormFile file,
        CancellationToken cancellationToken = default);

    /// <summary>Drops the mark from one of the caller's own experiences.</summary>
    Task<ExperienceDto> RemoveExperienceLogoAsync(
        int experienceId,
        CancellationToken cancellationToken = default);

    /// <summary>A signed link to an experience's company mark. Public, like the timeline it is on.</summary>
    Task<Uri> GetExperienceLogoUrlAsync(int experienceId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes every object belonging to a post from the bucket. Called as a post is deleted:
    /// the database drops the rows by cascade, and nothing else would ever go looking for
    /// the files they pointed at.
    /// </summary>
    Task PurgePostObjectsAsync(int postId, int authorId, CancellationToken cancellationToken = default);

    /// <summary>The same, as an experience is deleted.</summary>
    Task PurgeExperienceObjectsAsync(
        int experienceId,
        int authorId,
        CancellationToken cancellationToken = default);

    /// <summary>The same, for everything an account ever uploaded — its posts and its avatar.</summary>
    Task PurgeAuthorObjectsAsync(int authorId, CancellationToken cancellationToken = default);
}
