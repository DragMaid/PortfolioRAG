using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories;

public class AuthorRepository : IAuthorRepository
{
    private readonly BlogDbContext _context;

    public AuthorRepository(BlogDbContext context)
    {
        _context = context;
    }

    public Task<Author?> GetByIdAsync(int id, bool tracked = false, CancellationToken cancellationToken = default) =>
        WithProfile(tracked).FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

    public Task<Author?> GetByEmailAsync(
        string email,
        bool tracked = false,
        CancellationToken cancellationToken = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return WithProfile(tracked).FirstOrDefaultAsync(a => a.Email.ToLower() == normalized, cancellationToken);
    }

    /// <summary>Handful function to include both lists in author in response.</summary>
    private IQueryable<Author> WithProfile(bool tracked)
    {
        var query = tracked ? _context.Authors : _context.Authors.AsNoTracking();

        return query
            .Include(a => a.Experiences)
            .Include(a => a.ContactChannels);
    }

    public Task<ExternalLogin?> GetExternalLoginAsync(
        ExternalLoginProvider provider,
        string subject,
        CancellationToken cancellationToken = default) =>
        _context.ExternalLogins.FirstOrDefaultAsync(
            e => e.Provider == provider && e.Subject == subject,
            cancellationToken);

    public async Task<IReadOnlyList<ExternalLogin>> GetExternalLoginsAsync(
        int authorId,
        CancellationToken cancellationToken = default) =>
        await _context.ExternalLogins
            .AsNoTracking()
            .Where(e => e.AuthorId == authorId)
            .ToListAsync(cancellationToken);

    public async Task AddExternalLoginAsync(ExternalLogin login, CancellationToken cancellationToken = default) =>
        await _context.ExternalLogins.AddAsync(login, cancellationToken);

    public async Task<IReadOnlyList<Author>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await WithProfile(tracked: false)
            .OrderBy(a => a.Name)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Experience>> GetExperiencesAsync(
        int authorId,
        CancellationToken cancellationToken = default) =>
        await _context.Experiences
            .AsNoTracking()
            .Where(e => e.AuthorId == authorId)
            .OrderBy(e => e.StartedOn)
            .ThenBy(e => e.Id)
            .ToListAsync(cancellationToken);

    public Task<Experience?> GetExperienceAsync(
        int id,
        bool tracked = false,
        CancellationToken cancellationToken = default)
    {
        var query = tracked ? _context.Experiences : _context.Experiences.AsNoTracking();
        return query.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
    }

    public async Task AddExperienceAsync(Experience experience, CancellationToken cancellationToken = default) =>
        await _context.Experiences.AddAsync(experience, cancellationToken);

    public void RemoveExperience(Experience experience) => _context.Experiences.Remove(experience);

    public async Task<IReadOnlyList<ContactChannel>> GetContactChannelsAsync(
        int authorId,
        CancellationToken cancellationToken = default) =>
        await _context.ContactChannels
            .AsNoTracking()
            .Where(c => c.AuthorId == authorId)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .ToListAsync(cancellationToken);

    public Task<ContactChannel?> GetContactChannelAsync(
        int id,
        bool tracked = false,
        CancellationToken cancellationToken = default)
    {
        var query = tracked ? _context.ContactChannels : _context.ContactChannels.AsNoTracking();
        return query.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
    }

    public async Task AddContactChannelAsync(
        ContactChannel channel,
        CancellationToken cancellationToken = default) =>
        await _context.ContactChannels.AddAsync(channel, cancellationToken);

    public void RemoveContactChannel(ContactChannel channel) => _context.ContactChannels.Remove(channel);

    public Task<bool> EmailExistsAsync(
        string email,
        int? excludingAuthorId = null,
        CancellationToken cancellationToken = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return _context.Authors.AnyAsync(
            a => a.Email.ToLower() == normalized && (excludingAuthorId == null || excludingAuthorId != a.Id),
            cancellationToken);
    }

    public async Task AddAsync(Author author, CancellationToken cancellationToken = default) =>
        await _context.Authors.AddAsync(author, cancellationToken);

    public void Remove(Author author) => _context.Authors.Remove(author);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);
}

