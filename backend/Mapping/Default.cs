using Backend.Models.DTOs;
using Backend.Models.DTOs.Auth;
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
        Handle = author.Handle,
        AvatarUrl = author.ResolveAvatarUrl(),
        Title = author.Title,
        Headline = author.Headline,
        Biography = author.Biography,
        FooterBio = author.FooterBio,
        Location = author.Location,
        Availability = author.Availability,
        Focus = author.Focus,
        ContactPitch = author.ContactPitch,
        CreatedAt = author.CreatedAt,

        // Sorting the experiences based on time
        Experiences = author.Experiences
            .OrderBy(e => e.StartedOn)
            .ThenBy(e => e.Id)
            .Select(e => e.ToDto())
            .ToList(),

        // Sorting the contact channels based on user prefered index
        ContactChannels = author.ContactChannels
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .Select(c => c.ToDto())
            .ToList()
    };

    public static ExperienceDto ToDto(this Experience experience) => new()
    {
        Id = experience.Id,
        AuthorId = experience.AuthorId,
        Company = experience.Company,
        Role = experience.Role,
        Team = experience.Team,
        Description = experience.Description,
        LogoUrl = experience.ResolveLogoUrl(),
        StartedOn = experience.StartedOn,
        EndedOn = experience.EndedOn
    };

    /// <summary>
    /// Where a reader fetches a company mark, or null when none was uploaded. A path on
    /// this API for the same reason an avatar is one — see <see cref="ResolveAvatarUrl"/>.
    /// </summary>
    public static string? ResolveLogoUrl(this Experience experience) =>
        experience.LogoObjectKey is null ? null : $"/api/experiences/{experience.Id}/logo";

    public static ContactChannelDto ToDto(this ContactChannel channel) => new()
    {
        Id = channel.Id,
        AuthorId = channel.AuthorId,
        Label = channel.Label,
        Url = channel.Url,
        Handle = channel.Handle,
        SortOrder = channel.SortOrder
    };

    /// <summary>
    /// The account owner's own view. Never returned for anyone but the signed-in author,
    /// since it reports which sign-in methods the account has.
    /// </summary>
    public static AuthProfileDto ToProfileDto(
        this Author author,
        IReadOnlyList<ExternalLoginProvider> linkedProviders) => new()
    {
        Id = author.Id,
        Name = author.Name,
        Email = author.Email,
        Handle = author.Handle,
        AvatarUrl = author.ResolveAvatarUrl(),
        Biography = author.Biography,
        CreatedAt = author.CreatedAt,
        HasPassword = author.PasswordHash is not null,
        IsEmailConfirmed = author.EmailConfirmedAt is not null,
        LinkedProviders = linkedProviders
    };

    /// <summary>
    /// Where a reader fetches this author's picture, or null when they never uploaded one.
    /// A path on this API rather than an address: the bucket is private, so that route mints
    /// a link that expires, and this one does not.
    /// </summary>
    public static string? ResolveAvatarUrl(this Author author) =>
        author.AvatarObjectKey is null ? null : $"/api/authors/{author.Id}/avatar";

    public static MediaDto ToDto(this Media media) => new()
    {
        Id = media.Id,
        Filename = media.Filename,
        Url = $"/api/media/{media.Id}/content",
        Extension = media.Extension,
        Role = media.Role,
        Caption = media.Caption,
        ByteSize = media.ByteSize,
        PostId = media.PostId,
        CreatedAt = media.CreatedAt
    };

    public static AuthorSummaryDto ToSummaryDto(this Author author) => new()
    {
        Id = author.Id,
        Name = author.Name
    };

    public static PostDto ToDto(this Post post) => new()
    {
        Id = post.Id,
        Title = post.Title,
        Slug = post.Slug,
        Summary = post.Summary,
        Body = post.Body,
        IsDraft = post.IsDraft,
        IsFeatured = post.IsFeatured,
        Category = post.Category,
        Domain = post.Domain,
        RepoUrl = post.RepoUrl,
        DemoUrl = post.DemoUrl,
        SpecUrl = post.SpecUrl,
        Thumbnail = post.FindMedia(MediaRole.Thumbnail)?.ToDto(),
        Trailer = post.FindMedia(MediaRole.Trailer)?.ToDto(),
        Author = post.Author.ToSummaryDto(),
        ViewCount = post.ViewCount,
        CreatedAt = post.CreatedAt,
        UpdatedAt = post.UpdatedAt,
        PublishedAt = post.PublishedAt
    };

    /// <summary>
    /// The post's thumbnail or trailer, or null when it has not been given one yet.
    ///
    /// Reads the loaded collection rather than querying, so a caller that did not include
    /// the media sees null instead of paying for a lazy load per post in a listing. Every
    /// path that maps a post to a DTO includes it — see <c>PostRepository.BaseQuery</c>.
    /// </summary>
    private static Media? FindMedia(this Post post, MediaRole role) =>
        post.Medias.FirstOrDefault(media => media.Role == role);

    public static PostSummaryDto ToSummaryDto(this Post post) => new()
    {
        Id = post.Id,
        Title = post.Title,
        Slug = post.Slug,
        Summary = post.Summary,
        IsDraft = post.IsDraft,
        IsFeatured = post.IsFeatured,
        Category = post.Category,
        Domain = post.Domain,
        RepoUrl = post.RepoUrl,
        DemoUrl = post.DemoUrl,
        SpecUrl = post.SpecUrl,
        Thumbnail = post.FindMedia(MediaRole.Thumbnail)?.ToDto(),
        Trailer = post.FindMedia(MediaRole.Trailer)?.ToDto(),
        Author = post.Author.ToSummaryDto(),
        ViewCount = post.ViewCount,
        CreatedAt = post.CreatedAt,
        PublishedAt = post.PublishedAt
    };
}
