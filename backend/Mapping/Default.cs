using Backend.Models.DTOs;
using Backend.Models.Entities;

namespace Backend.Mapping;

// TODO: if the project continues to grow then do split this into many mappings
// one should suffice for now, dont wanna do premature optimization
public static class MappingExtensions
{
    public static AuthorDto ToDto(this Author author) => new()
    {
        Id = author.Id,
        Name = author.Name,
        Email = author.Email,
        Biography = author.Biography,
        CreatedAt = author.CreatedAt
    };

    public static AuthorSummaryDto ToSummaryDto(this Author author) => new()
    {
        Id = author.Id,
        Name = author.Name
    };

    public static PostDto ToDto(this Post post, int commentCount) => new()
    {
        Id = post.Id,
        Title = post.Title,
        Slug = post.Slug,
        Summary = post.Summary,
        Body = post.Body,
        IsDraft = post.IsDraft,
        Author = post.Author.ToSummaryDto(),
        ViewCount = post.ViewCount,
        CreatedAt = post.CreatedAt,
        UpdatedAt = post.UpdatedAt,
        PublishedAt = post.PublishedAt
    };

    public static PostSummaryDto ToSummaryDto(this Post post, int commentCount) => new()
    {
        Id = post.Id,
        Title = post.Title,
        Slug = post.Slug,
        Summary = post.Summary,
        IsDraft = post.IsDraft,
        Author = post.Author.ToSummaryDto(),
        ViewCount = post.ViewCount,
        CreatedAt = post.CreatedAt,
        PublishedAt = post.PublishedAt
    };
}
