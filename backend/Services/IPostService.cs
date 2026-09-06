using Backend.Models.DTOs;
using Backend.Models.Requests;

namespace Backend.Services;

public interface IPostService
{
    /// <summary>The public feed: published posts by any author, no caller required.</summary>
    Task<PagedResult<PostSummaryDto>> GetPublicAsync(
            PostQueryRequest request,
            CancellationToken cancellationToken = default);

    /// <summary>
    /// The authoring feed: the signed-in author's own posts. Pass isDraft to narrow it to
    /// drafts or published posts; null returns both. Always scoped to the caller.
    /// </summary>
    Task<PagedResult<PostSummaryDto>> GetByDraftAsync(
        PostQueryRequest request,
        bool? isDraft = null,
        CancellationToken cancellationToken = default);

    Task<PostDto> GetPublicBySlugAsync(string slug, CancellationToken cancellationToken = default);

    /// <summary>Reads one of the caller's own posts, draft or not.</summary>
    Task<PostDto> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Creates a draft owned by the caller. The author is never taken from the body.</summary>
    Task<PostDto> CreateAsync(CreatePostDto dto, CancellationToken cancellationToken = default);

    Task<PostDto> UpdateAsync(int id, UpdatePostDto dto, CancellationToken cancellationToken = default);

    Task<PostDto> PublishAsync(int id, CancellationToken cancellationToken = default);

    Task<PostDto> UnpublishAsync(int id, CancellationToken cancellationToken = default);

    Task DeleteAsync(int id, CancellationToken cancellationToken = default);

    Task<int> RegisterViewAsync(string slug, CancellationToken cancellationToken = default);
}
