using Backend.Common.Exceptions;
using Backend.Repositories;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Models.Requests;
using Backend.Mapping;
using Backend.Common;
using Backend.Common.Security;

namespace Backend.Services;

public class PostService : IPostService
{
    private readonly IPostRepository _posts;
    private readonly IAuthorRepository _authors;
    private readonly ICurrentUser _currentUser;
    private readonly TimeProvider _timeProvider;

    public PostService(
        IPostRepository posts,
        IAuthorRepository authors,
        ICurrentUser currentUser,
        TimeProvider timeProvider)
    {
        _posts = posts;
        _authors = authors;
        _currentUser = currentUser;
        _timeProvider = timeProvider;
    }

    public Task<PagedResult<PostSummaryDto>> GetPublicAsync(
        PostQueryRequest request,
        CancellationToken cancellationToken = default) =>
        QueryAsync(request, cancellationToken, isDraft: false);

    public Task<PagedResult<PostSummaryDto>> GetByDraftAsync(
        PostQueryRequest request,
        bool? isDraft = null,
        CancellationToken cancellationToken = default)
    {
        // NOTE: the authoring list only ever shows the caller's own posts, so whatever
        // AuthorId the query string asked for is overwritten rather than trusted. Drafts
        // are only ever reachable through this path.
        request.AuthorId = _currentUser.RequireAuthorId();
        return QueryAsync(request, cancellationToken, isDraft: isDraft);
    }

    public async Task<PostDto> GetPublicBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default) 
    {
        var normalized = slug.Trim().ToLowerInvariant();

        var post = await _posts.GetBySlugAsync(normalized, tracked: false, cancellationToken);

        if (post is null || post.IsDraft)
            throw NotFoundException.For("Post", slug);

        return post.ToDto();
    }

    public async Task<PostDto> GetByIdAsync(
            int id,
            CancellationToken cancellationToken = default)
    {
        var post = await _posts.GetByIdAsync(id, tracked: false, cancellationToken)
            ?? throw NotFoundException.For("Post", id);

        EnsureOwnedByCaller(post);
        return post.ToDto();
    }

    public async Task<PostDto> CreateAsync(CreatePostDto dto, CancellationToken cancellationToken = default)
    {
        // NOTE: the author is taken from the access token, never from the request body.
        // There is no way to ask for a post to be filed under somebody else.
        var authorId = _currentUser.RequireAuthorId();

        var author = await _authors.GetByIdAsync(authorId, tracked: true, cancellationToken)
            ?? throw new UnauthorizedException("The signed-in account no longer exists.");

        var slug = await ResolveSlugAsync(dto.Slug, dto.Title, excludingPostId: null, cancellationToken);
        var now = _timeProvider.GetUtcNow();

        // NOTE: the state of the post is always draft in the beginning until officially published
        var post = new Post
        {
            Title = dto.Title.Trim(),
            Slug = slug,
            Summary = string.IsNullOrWhiteSpace(dto.Summary) ? null : dto.Summary.Trim(),
            Body = dto.Body,
            Author = author,
            IsDraft = true,
            CreatedAt = now,
            UpdatedAt = now,
            PublishedAt = null
        };

        await _posts.AddAsync(post, cancellationToken);
        await _posts.SaveChangesAsync(cancellationToken);
        return post.ToDto();
    }

    public async Task<PostDto> UpdateAsync(
        int id,
        UpdatePostDto dto,
        CancellationToken cancellationToken = default)
    {
        var post = await _posts.GetByIdAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Post", id);

        EnsureOwnedByCaller(post);

        if (!string.IsNullOrWhiteSpace(dto.Slug))
            post.Slug = await ResolveSlugAsync(dto.Slug, dto.Title, excludingPostId: id, cancellationToken);

        post.Title = dto.Title.Trim();
        post.Summary = string.IsNullOrWhiteSpace(dto.Summary) ? null : dto.Summary.Trim();
        post.Body = dto.Body;
        post.UpdatedAt = _timeProvider.GetUtcNow();

        await _posts.SaveChangesAsync(cancellationToken);
        return post.ToDto();
    }

    // NOTE: putting explicit business operation functions for readability
    public Task<PostDto> PublishAsync(int id, CancellationToken cancellationToken = default) =>
        ChangeStatusAsync(id, isDraft: false, cancellationToken);

    public Task<PostDto> UnpublishAsync(int id, CancellationToken cancellationToken = default) =>
        ChangeStatusAsync(id, isDraft: true, cancellationToken);

    private async Task<PagedResult<PostSummaryDto>> QueryAsync(
        PostQueryRequest request,
        CancellationToken cancellationToken,
        bool? isDraft = null)
    {
        var (items, totalItems) = await _posts.QueryAsync(request, isDraft, cancellationToken);
        return new PagedResult<PostSummaryDto>
        {
            Items = items
                .Select(p => p.ToSummaryDto())
                .ToList(),
            Page = request.Page,
            PageSize = request.PageSize,
            TotalItems = totalItems
        };
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var post = await _posts.GetByIdAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Post", id);

        EnsureOwnedByCaller(post);
        await _posts.RemoveAsync(post, cancellationToken);
        await _posts.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> RegisterViewAsync(string slug, CancellationToken cancellationToken = default)
    {
        var normalized = slug.Trim().ToLowerInvariant();

        var post = await _posts.GetBySlugAsync(normalized, tracked: true, cancellationToken);

        if (post is null || post.IsDraft)
            throw NotFoundException.For("Post", slug);

        post.ViewCount++;
        await _posts.SaveChangesAsync(cancellationToken);

        return post.ViewCount;
    }

    private async Task<PostDto> ChangeStatusAsync(
        int id,
        bool isDraft,
        CancellationToken cancellationToken)
    {
        var post = await _posts.GetByIdAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Post", id);

        EnsureOwnedByCaller(post);

        var now = _timeProvider.GetUtcNow();
        post.IsDraft = isDraft;
        post.UpdatedAt = now;

        // NOTE: stamp the first publication only. Re-publishing after a spell as a draft
        // keeps the original date so the public ordering does not shuffle.
        if (!isDraft)
            post.PublishedAt ??= now;

        await _posts.SaveChangesAsync(cancellationToken);
        return post.ToDto();
    }

    /// <summary>
    /// The single ownership rule: an author may only ever act on their own posts. Nobody —
    /// no role, no flag — writes or publishes on another author's behalf.
    /// </summary>
    private void EnsureOwnedByCaller(Post post)
    {
        if (post.AuthorId != _currentUser.RequireAuthorId())
            throw ForbiddenException.For("post", post.Id);
    }

    private async Task<string> ResolveSlugAsync(
        string? requestedSlug,
        string title,
        int? excludingPostId,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(requestedSlug))
        {
            var slug = requestedSlug.Trim().ToLowerInvariant();

            if (await _posts.SlugExistsAsync(slug, excludingPostId, cancellationToken))
            {
                throw new ConflictException($"A post with the slug '{slug}' already exists.");
            }
            return slug;
        }

        return await SlugGenerator.GenerateUniqueAsync(
            title,
            candidate => _posts.SlugExistsAsync(candidate, excludingPostId, cancellationToken),
            cancellationToken);
    }
}
