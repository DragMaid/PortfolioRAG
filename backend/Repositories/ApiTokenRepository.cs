using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories;

public class ApiTokenRepository : IApiTokenRepository
{
    private readonly BlogDbContext _context;

    public ApiTokenRepository(BlogDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<ApiToken>> GetByAuthorAsync(
        int authorId,
        CancellationToken cancellationToken = default) =>
        await _context.ApiTokens
            .AsNoTracking()
            .Where(t => t.AuthorId == authorId)
            .OrderByDescending(t => t.CreatedAt)
            .ThenByDescending(t => t.Id)
            .ToListAsync(cancellationToken);

    public Task<ApiToken?> GetAsync(
        int id,
        int authorId,
        bool tracked = true,
        CancellationToken cancellationToken = default)
    {
        var query = tracked ? _context.ApiTokens : _context.ApiTokens.AsNoTracking();
        return query.FirstOrDefaultAsync(t => t.Id == id && t.AuthorId == authorId, cancellationToken);
    }

    // Include the author in 1 round trip to authenticate
    public Task<ApiToken?> GetByHashAsync(
        string tokenHash,
        bool tracked = true,
        CancellationToken cancellationToken = default)
    {
        var query = tracked ? _context.ApiTokens : _context.ApiTokens.AsNoTracking();

        return query
            .Include(t => t.Author)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);
    }

    public Task<bool> NameExistsAsync(
        int authorId,
        string name,
        int? excludingTokenId = null,
        CancellationToken cancellationToken = default) =>
        _context.ApiTokens.AnyAsync(
            t => t.AuthorId == authorId &&
                 t.RevokedAt == null &&
                 t.Name.ToLower() == name.ToLower() &&
                 (excludingTokenId == null || t.Id != excludingTokenId),
            cancellationToken);

    public async Task AddAsync(ApiToken token, CancellationToken cancellationToken = default) =>
        await _context.ApiTokens.AddAsync(token, cancellationToken);

    public void Remove(ApiToken token) => _context.ApiTokens.Remove(token);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);
}
