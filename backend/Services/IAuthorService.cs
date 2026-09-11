using Backend.Models.DTOs;

namespace Backend.Services;

public interface IAuthorService
{
    Task<IReadOnlyList<AuthorDto>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<AuthorDto> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>The account at a public handle. How <c>/{handle}</c> resolves to a portfolio.</summary>
    Task<AuthorDto> GetByHandleAsync(string handle, CancellationToken cancellationToken = default);

    // NOTE: accounts are created by POST /api/auth/register, which is the only path that
    // can attach credentials to one.

    /// <summary>Updates the caller's own profile. Any other id is forbidden.</summary>
    Task<AuthorDto> UpdateAsync(int id, UpdateAuthorDto dto, CancellationToken cancellationToken = default);

    /// <summary>Deletes the caller's own account. Any other id is forbidden.</summary>
    Task DeleteAsync(int id, CancellationToken cancellationToken = default);

    // -----------------------------------------------------------------------
    // Experience
    // -----------------------------------------------------------------------

    /// <summary>One author's timeline, oldest first. Public, like the profile it belongs to.</summary>
    Task<IReadOnlyList<ExperienceDto>> GetExperiencesAsync(
        int authorId,
        CancellationToken cancellationToken = default);

    Task<ExperienceDto> GetExperienceAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Adds a job to the caller's own timeline.</summary>
    Task<ExperienceDto> AddExperienceAsync(
        ExperienceInputDto dto,
        CancellationToken cancellationToken = default);

    /// <summary>Rewrites one of the caller's own jobs. Any other author's is forbidden.</summary>
    Task<ExperienceDto> UpdateExperienceAsync(
        int id,
        ExperienceInputDto dto,
        CancellationToken cancellationToken = default);

    /// <summary>Removes one of the caller's own jobs, its uploaded logo included.</summary>
    Task DeleteExperienceAsync(int id, CancellationToken cancellationToken = default);

    // -----------------------------------------------------------------------
    // Contact channels
    // -----------------------------------------------------------------------

    /// <summary>One author's contact links, in the order they set.</summary>
    Task<IReadOnlyList<ContactChannelDto>> GetContactChannelsAsync(
        int authorId,
        CancellationToken cancellationToken = default);

    /// <summary>Adds a link to the caller's own profile.</summary>
    Task<ContactChannelDto> AddContactChannelAsync(
        ContactChannelInputDto dto,
        CancellationToken cancellationToken = default);

    Task<ContactChannelDto> UpdateContactChannelAsync(
        int id,
        ContactChannelInputDto dto,
        CancellationToken cancellationToken = default);

    Task DeleteContactChannelAsync(int id, CancellationToken cancellationToken = default);
}
