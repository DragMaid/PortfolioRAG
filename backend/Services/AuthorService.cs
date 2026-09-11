using Backend.Common.Exceptions;
using Backend.Common.Security;
using Backend.Mapping;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Services;

public class AuthorService : IAuthorService
{
    private readonly IAuthorRepository _authors;
    private readonly IMediaService _media;
    private readonly ICurrentUser _currentUser;
    private readonly TimeProvider _timeProvider;

    public AuthorService(
        IAuthorRepository authors,
        IMediaService media,
        ICurrentUser currentUser,
        TimeProvider timeProvider)
    {
        _authors = authors;
        _media = media;
        _currentUser = currentUser;
        _timeProvider = timeProvider;
    }

    public async Task<IReadOnlyList<AuthorDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var authors = await _authors.GetAllAsync(cancellationToken);
        return authors.Select(a => a.ToDto()).ToList();
    }

    public async Task<AuthorDto> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var author = await _authors.GetByIdAsync(id, tracked: false, cancellationToken)
            ?? throw NotFoundException.For("Author", id);
        return author.ToDto();
    }

    public async Task<AuthorDto> UpdateAsync(
        int id,
        UpdateAuthorDto dto,
        CancellationToken cancellationToken = default)
    {
        EnsureSelf(id);

        var author = await _authors.GetByIdAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Author", id);

        var email = dto.Email.Trim().ToLowerInvariant();

        if (await _authors.EmailExistsAsync(email, id, cancellationToken))
            throw new ConflictException($"An author with the email '{email}' already exists.");

        // NOTE: making sure that the new linked email is not the current one being used
        if (!string.Equals(author.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            author.EmailConfirmedAt = null;
        }

        author.Name = dto.Name.Trim();
        author.Email = email;
        author.Title = Clean(dto.Title);
        author.Headline = Clean(dto.Headline);
        author.Biography = Clean(dto.Biography);
        author.FooterBio = Clean(dto.FooterBio);
        author.Location = Clean(dto.Location);
        author.Availability = Clean(dto.Availability);
        author.Focus = Clean(dto.Focus);
        author.ContactPitch = Clean(dto.ContactPitch);

        await _authors.SaveChangesAsync(cancellationToken);
        return author.ToDto();
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        EnsureSelf(id);

        var author = await _authors.GetByIdAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Author", id);

        // NOTE: closing an account takes everything with it — posts, their media, the
        // external logins and every refresh token
        _authors.Remove(author);
        await _authors.SaveChangesAsync(cancellationToken);

        // The cascade clears the rows; the bucket has never heard of them. Everything this
        // account ever uploaded lives under one prefix precisely so this is one sweep.
        await _media.PurgeAuthorObjectsAsync(id, cancellationToken);
    }

    // -----------------------------------------------------------------------
    // Experience
    // -----------------------------------------------------------------------

    public async Task<IReadOnlyList<ExperienceDto>> GetExperiencesAsync(
        int authorId,
        CancellationToken cancellationToken = default)
    {
        var experiences = await _authors.GetExperiencesAsync(authorId, cancellationToken);
        return experiences.Select(e => e.ToDto()).ToList();
    }

    public async Task<ExperienceDto> GetExperienceAsync(int id, CancellationToken cancellationToken = default)
    {
        var experience = await _authors.GetExperienceAsync(id, tracked: false, cancellationToken)
            ?? throw NotFoundException.For("Experience", id);

        return experience.ToDto();
    }

    public async Task<ExperienceDto> AddExperienceAsync(
        ExperienceInputDto dto,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();

        var experience = new Experience
        {
            AuthorId = authorId,
            CreatedAt = _timeProvider.GetUtcNow()
        };

        Apply(dto, experience);

        await _authors.AddExperienceAsync(experience, cancellationToken);
        await _authors.SaveChangesAsync(cancellationToken);

        return experience.ToDto();
    }

    public async Task<ExperienceDto> UpdateExperienceAsync(
        int id,
        ExperienceInputDto dto,
        CancellationToken cancellationToken = default)
    {
        var experience = await LoadOwnExperienceAsync(id, cancellationToken);

        Apply(dto, experience);

        await _authors.SaveChangesAsync(cancellationToken);
        return experience.ToDto();
    }

    public async Task DeleteExperienceAsync(int id, CancellationToken cancellationToken = default)
    {
        var experience = await LoadOwnExperienceAsync(id, cancellationToken);
        var authorId = experience.AuthorId;

        _authors.RemoveExperience(experience);
        await _authors.SaveChangesAsync(cancellationToken);

        // The row is gone, so nothing will ever name the logo's key again — the same sweep
        // a deleted post gets, for the same reason.
        await _media.PurgeExperienceObjectsAsync(id, authorId, cancellationToken);
    }

    // -----------------------------------------------------------------------
    // Contact channels
    // -----------------------------------------------------------------------

    public async Task<IReadOnlyList<ContactChannelDto>> GetContactChannelsAsync(
        int authorId,
        CancellationToken cancellationToken = default)
    {
        var channels = await _authors.GetContactChannelsAsync(authorId, cancellationToken);
        return channels.Select(c => c.ToDto()).ToList();
    }

    public async Task<ContactChannelDto> AddContactChannelAsync(
        ContactChannelInputDto dto,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();

        var channel = new ContactChannel
        {
            AuthorId = authorId,
            CreatedAt = _timeProvider.GetUtcNow()
        };

        Apply(dto, channel);

        await _authors.AddContactChannelAsync(channel, cancellationToken);
        await _authors.SaveChangesAsync(cancellationToken);

        return channel.ToDto();
    }

    public async Task<ContactChannelDto> UpdateContactChannelAsync(
        int id,
        ContactChannelInputDto dto,
        CancellationToken cancellationToken = default)
    {
        var channel = await _authors.GetContactChannelAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("ContactChannel", id);

        EnsureSelf(channel.AuthorId, "contact channel", id);

        Apply(dto, channel);

        await _authors.SaveChangesAsync(cancellationToken);
        return channel.ToDto();
    }

    public async Task DeleteContactChannelAsync(int id, CancellationToken cancellationToken = default)
    {
        var channel = await _authors.GetContactChannelAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("ContactChannel", id);

        EnsureSelf(channel.AuthorId, "contact channel", id);

        _authors.RemoveContactChannel(channel);
        await _authors.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// One of the caller's own experiences, tracked and ready to change. Another author's
    /// is forbidden; the logo endpoints go through here too, so that rule is stated once.
    /// </summary>
    private async Task<Experience> LoadOwnExperienceAsync(int id, CancellationToken cancellationToken)
    {
        var experience = await _authors.GetExperienceAsync(id, tracked: true, cancellationToken)
            ?? throw NotFoundException.For("Experience", id);

        EnsureSelf(experience.AuthorId, "experience", id);
        return experience;
    }

    private void Apply(ExperienceInputDto dto, Experience experience)
    {
        if (dto.EndedOn is { } ended && ended < dto.StartedOn)
            throw new ValidationException("A job cannot end before it started.");

        experience.Company = dto.Company.Trim();
        experience.Role = dto.Role.Trim();
        experience.Team = Clean(dto.Team);
        experience.Description = Clean(dto.Description);
        experience.StartedOn = dto.StartedOn;
        experience.EndedOn = dto.EndedOn;
    }

    private static void Apply(ContactChannelInputDto dto, ContactChannel channel)
    {
        channel.Label = dto.Label.Trim();

        // NOTE: trimmed and otherwise stored exactly as it arrived. Nothing here parses the
        // address, adds a scheme to it or decides what service it belongs to — that is the
        // reader's job, and leaving it alone is what lets an author link to anything.
        channel.Url = dto.Url.Trim();
        channel.Handle = Clean(dto.Handle);
        channel.SortOrder = dto.SortOrder;
    }

    /// <summary>Trimmed, or null when what is left is nothing. Every profile field is optional.</summary>
    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>
    /// An author account may only be changed by its owner — there is no administrator who
    /// can edit or delete somebody else's.
    /// </summary>
    private void EnsureSelf(int id)
    {
        if (id != _currentUser.RequireAuthorId())
            throw ForbiddenException.For("author", id);
    }

    /// <summary>
    /// The same rule for the things that hang off an account. A 403 rather than a 404: the
    /// experiences and channels of every author are public, so which ids exist is not a
    /// secret this could give away.
    /// </summary>
    private void EnsureSelf(int ownerId, string resource, int resourceId)
    {
        if (ownerId != _currentUser.RequireAuthorId())
            throw ForbiddenException.For(resource, resourceId);
    }
}
