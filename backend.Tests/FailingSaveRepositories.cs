using Backend.Models.Entities;
using Backend.Repositories;

namespace Backend.Tests;

/// <summary>
/// Wraps a repository so that one <c>SaveChangesAsync</c> can be made to fail.
/// </summary>
/// <remarks>
/// This is the only way to reach the compensating deletes in <c>MediaService</c>. They fire
/// when the database rejects the row for an object that is already in the bucket, and they
/// exist so that no object outlives the only record of its key. A storage double cannot
/// provoke that — the throw has to come from the save.
/// Inert until <see cref="FailNextSave"/> is set, so wiring it in changes nothing else.
/// </remarks>
// NOTE: the sealed here prevent the class from being further inherited
// TODO: maybe consider putting the repository to be virutal so that I can override the implementation of one
public sealed class FailingSaveMediaRepository : IMediaRepository
{
    private readonly IMediaRepository _inner;

    public FailingSaveMediaRepository(IMediaRepository inner)
    {
        _inner = inner;
    }

    public bool FailNextSave { get; set; }

    public Task<Media?> GetByIdAsync(int id, bool tracked = false, CancellationToken cancellationToken = default) =>
        _inner.GetByIdAsync(id, tracked, cancellationToken);

    public Task<IReadOnlyList<Media>> GetByPostIdAsync(int postId, CancellationToken cancellationToken = default) =>
        _inner.GetByPostIdAsync(postId, cancellationToken);

    public Task AddAsync(Media media, CancellationToken cancellationToken = default) =>
        _inner.AddAsync(media, cancellationToken);

    public void Remove(Media media) => _inner.Remove(media);

    public void RemoveRange(IEnumerable<Media> medias) => _inner.RemoveRange(medias);

    // NOTE: we can deliberately set FailNextSave in order to test failure
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        if (FailNextSave)
        {
            FailNextSave = false;
            throw new InvalidOperationException("The save was made to fail by a test.");
        }

        return _inner.SaveChangesAsync(cancellationToken);
    }
}

/// <summary>The same, for the avatar path. See <see cref="FailingSaveMediaRepository"/>.</summary>
public sealed class FailingSaveAuthorRepository : IAuthorRepository
{
    private readonly IAuthorRepository _inner;

    public FailingSaveAuthorRepository(IAuthorRepository inner)
    {
        _inner = inner;
    }

    public bool FailNextSave { get; set; }

    public Task<Author?> GetByIdAsync(int id, bool tracked = false, CancellationToken cancellationToken = default) =>
        _inner.GetByIdAsync(id, tracked, cancellationToken);

    public Task<Author?> GetByEmailAsync(string email, bool tracked = false, CancellationToken cancellationToken = default) =>
        _inner.GetByEmailAsync(email, tracked, cancellationToken);

    public Task<Author?> GetByHandleAsync(string handle, bool tracked = false, CancellationToken cancellationToken = default) =>
        _inner.GetByHandleAsync(handle, tracked, cancellationToken);

    public Task<IReadOnlyList<Author>> GetAllAsync(CancellationToken cancellationToken = default) =>
        _inner.GetAllAsync(cancellationToken);

    public Task<bool> EmailExistsAsync(string email, int? excludingAuthorId = null, CancellationToken cancellationToken = default) =>
        _inner.EmailExistsAsync(email, excludingAuthorId, cancellationToken);

    public Task<bool> HandleExistsAsync(string handle, int? excludingAuthorId = null, CancellationToken cancellationToken = default) =>
        _inner.HandleExistsAsync(handle, excludingAuthorId, cancellationToken);

    public Task<ExternalLogin?> GetExternalLoginAsync(
        ExternalLoginProvider provider,
        string subject,
        CancellationToken cancellationToken = default) =>
        _inner.GetExternalLoginAsync(provider, subject, cancellationToken);

    public Task<IReadOnlyList<ExternalLogin>> GetExternalLoginsAsync(
        int authorId,
        CancellationToken cancellationToken = default) =>
        _inner.GetExternalLoginsAsync(authorId, cancellationToken);

    public Task AddExternalLoginAsync(ExternalLogin login, CancellationToken cancellationToken = default) =>
        _inner.AddExternalLoginAsync(login, cancellationToken);

    public Task AddAsync(Author author, CancellationToken cancellationToken = default) =>
        _inner.AddAsync(author, cancellationToken);

    public Task<IReadOnlyList<Experience>> GetExperiencesAsync(
        int authorId,
        CancellationToken cancellationToken = default) =>
        _inner.GetExperiencesAsync(authorId, cancellationToken);

    public Task<Experience?> GetExperienceAsync(
        int id,
        bool tracked = false,
        CancellationToken cancellationToken = default) =>
        _inner.GetExperienceAsync(id, tracked, cancellationToken);

    public Task AddExperienceAsync(Experience experience, CancellationToken cancellationToken = default) =>
        _inner.AddExperienceAsync(experience, cancellationToken);

    public void RemoveExperience(Experience experience) => _inner.RemoveExperience(experience);

    public Task<IReadOnlyList<ContactChannel>> GetContactChannelsAsync(
        int authorId,
        CancellationToken cancellationToken = default) =>
        _inner.GetContactChannelsAsync(authorId, cancellationToken);

    public Task<ContactChannel?> GetContactChannelAsync(
        int id,
        bool tracked = false,
        CancellationToken cancellationToken = default) =>
        _inner.GetContactChannelAsync(id, tracked, cancellationToken);

    public Task AddContactChannelAsync(ContactChannel channel, CancellationToken cancellationToken = default) =>
        _inner.AddContactChannelAsync(channel, cancellationToken);

    public void RemoveContactChannel(ContactChannel channel) => _inner.RemoveContactChannel(channel);

    public void Remove(Author author) => _inner.Remove(author);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        if (FailNextSave)
        {
            FailNextSave = false;
            throw new InvalidOperationException("The save was made to fail by a test.");
        }

        return _inner.SaveChangesAsync(cancellationToken);
    }
}
