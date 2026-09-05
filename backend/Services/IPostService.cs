using Backend.Models.DTOs;
using Backend.Models.Requests;

namespace Backend.Services;

public interface IPostService
{
    // TODO: nah I think again this is a dumb way to handle it, im going to move
    // everything to just using the is draft boolean to determine what to get in the same query
    Task<PagedResult<PostSummaryDto>> GetPublicAsync(
            PostQueryRequest request,
            CancellationToken cancellationToken = default);

    Task<PagedResult<PostSummaryDto>> GetByDraftAsync(
        PostQueryRequest request,
        bool? isDraft = null,
        CancellationToken cancellationToken = default);

    Task<PostDto> GetPublicBySlugAsync(string slug, CancellationToken cancellationToken = default);

    Task<PostDto> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    Task<PostDto> CreateAsync(CreatePostDto dto, CancellationToken cancellationToken = default);

    Task<PostDto> UpdateAsync(int id, UpdatePostDto dto, CancellationToken cancellationToken = default);

    Task<PostDto> PublishAsync(int id, CancellationToken cancellationToken = default);

    Task<PostDto> UnpublishAsync(int id, CancellationToken cancellationToken = default);

    Task DeleteAsync(int id, CancellationToken cancellationToken = default);

    // TODO: this one seems kind of redundant, will consider removing it
    Task<int> RegisterViewAsync(string slug, CancellationToken cancellationToken = default);
}
