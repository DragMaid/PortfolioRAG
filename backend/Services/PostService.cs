using Backend.Common.Exceptions;
using Backend.Repositories;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Models.Requests;
using Backend.Mapping;
using Backend.Common;

namespace Backend.Services;

public class PostService : IPostService
{
    private readonly IPostRepository _posts;
    private readonly IAuthorRepository _authors;
    private readonly TimeProvider _timeProvider;

    public PostService(
        IPostRepository posts,
        IAuthorRepository authors,
        TimeProvider timeProvider)
    {
        _posts = posts;
        _authors = authors;
        _timeProvider = timeProvider;
    }

    public Task<PagedResult<PostSummaryDto>> GetPublicAsync(
        PostQueryRequest request,
        CancellationToken cancellationToken = default) =>
        QueryAsync(request, cancellationToken, isDraft: false);

    // TODO: not sure if I should do this one or not
    public Task<PagedResult<PostSummaryDto>> GetByDraftAsync(
        PostQueryRequest request,
        bool? isDraft = null,
        CancellationToken cancellationToken = default) =>
        QueryAsync(request, cancellationToken, isDraft: isDraft);

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
        return post.ToDto();
    }

    public async Task<PostDto> CreateAsync(CreatePostDto dto, CancellationToken cancellationToken = default)
    {
        var author = await _authors.GetByIdAsync(dto.AuthorId, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Author", dto.AuthorId);

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
        // TODO: fix the implementation of QueryAsync to use nullable isDraft
        var (items, totalItems) = await _posts.QueryAsync(request, isDraft, cancellationToken);

        // TODO: finish all the other components later, interface function implementations
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
        // TODO: this one doesnt really make sense to throw the exception here
        var post = await _posts.GetByIdAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Post", id);
        var now = _timeProvider.GetUtcNow();
        post.IsDraft = isDraft;
        post.UpdatedAt = now;

        await _posts.SaveChangesAsync(cancellationToken);
        return post.ToDto();
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
