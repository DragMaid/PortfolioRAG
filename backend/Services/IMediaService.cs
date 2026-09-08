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

    /// <summary>Removes one item from the caller's own post, bucket object included.</summary>
    Task DeleteAsync(int postId, int mediaId, CancellationToken cancellationToken = default);

    /// <summary>
    /// A signed link to one item's content. Readable by anyone once the post is published,
    /// and by nobody but its author before that.
    /// </summary>
    Task<Uri> GetContentUrlAsync(int mediaId, CancellationToken cancellationToken = default);

    /// <summary>Replaces the caller's own avatar. Returns the profile as it now reads.</summary>
    Task<AuthorDto> SetAvatarAsync(IFormFile file, CancellationToken cancellationToken = default);

    /// <summary>Drops the caller's uploaded avatar, falling back to whatever a provider supplied.</summary>
    Task<AuthorDto> RemoveAvatarAsync(CancellationToken cancellationToken = default);

    /// <summary>A signed link to an author's uploaded avatar. Public, like the profile it belongs to.</summary>
    Task<Uri> GetAvatarUrlAsync(int authorId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes every object belonging to a post from the bucket. Called as a post is deleted:
    /// the database drops the rows by cascade, and nothing else would ever go looking for
    /// the files they pointed at.
    /// </summary>
    Task PurgePostObjectsAsync(int postId, int authorId, CancellationToken cancellationToken = default);

    /// <summary>The same, for everything an account ever uploaded — its posts and its avatar.</summary>
    Task PurgeAuthorObjectsAsync(int authorId, CancellationToken cancellationToken = default);
}
