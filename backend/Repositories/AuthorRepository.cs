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

    public Task<Author?> GetByIdAsync(int id, bool tracked = false, CancellationToken cancellationToken = default)
    {
        var query = tracked ? _context.Authors : _context.Authors.AsNoTracking();
        return query.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
    }

    public Task<Author?> GetByEmailAsync(
        string email,
        bool tracked = false,
        CancellationToken cancellationToken = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        var query = tracked ? _context.Authors : _context.Authors.AsNoTracking();
        return query.FirstOrDefaultAsync(a => a.Email.ToLower() == normalized, cancellationToken);
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
        await _context.Authors
            .AsNoTracking()
            .OrderBy(a => a.Name)
            .ToListAsync(cancellationToken);

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

    // NOTE: using sync func here to return the task to be awaited outside of the code instead
    public Task<bool> HasPostsAsync(int authorId, CancellationToken cancellationToken = default) =>
        _context.Posts.AnyAsync(p => p.AuthorId == authorId, cancellationToken);

    public async Task AddAsync(Author author, CancellationToken cancellationToken = default) =>
        await _context.Authors.AddAsync(author, cancellationToken);

    public void Remove(Author author) => _context.Authors.Remove(author);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);
}

