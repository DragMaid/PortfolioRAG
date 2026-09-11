using Backend.Models.Entities;

namespace Backend.Repositories;

public interface IAuthorRepository
{
    Task<Author?> GetByIdAsync(int id, bool tracked = false, CancellationToken cancellationToken = default);

    Task<Author?> GetByEmailAsync(string email, bool tracked = false, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Author>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<bool> EmailExistsAsync(string email, int? excludingAuthorId = null, CancellationToken cancellationToken = default);

    Task<ExternalLogin?> GetExternalLoginAsync(
        ExternalLoginProvider provider,
        string subject,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ExternalLogin>> GetExternalLoginsAsync(
        int authorId,
        CancellationToken cancellationToken = default);

    Task AddExternalLoginAsync(ExternalLogin login, CancellationToken cancellationToken = default);

    Task AddAsync(Author author, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Experience>> GetExperiencesAsync(
        int authorId,
        CancellationToken cancellationToken = default);

    Task<Experience?> GetExperienceAsync(
        int id,
        bool tracked = false,
        CancellationToken cancellationToken = default);

    Task AddExperienceAsync(Experience experience, CancellationToken cancellationToken = default);

    void RemoveExperience(Experience experience);

    Task<IReadOnlyList<ContactChannel>> GetContactChannelsAsync(
        int authorId,
        CancellationToken cancellationToken = default);

    Task<ContactChannel?> GetContactChannelAsync(
        int id,
        bool tracked = false,
        CancellationToken cancellationToken = default);

    Task AddContactChannelAsync(ContactChannel channel, CancellationToken cancellationToken = default);

    void RemoveContactChannel(ContactChannel channel);

    void Remove(Author author);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
