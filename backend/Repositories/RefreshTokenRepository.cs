using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories;

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly BlogDbContext _context;

    public RefreshTokenRepository(BlogDbContext context)
    {
        _context = context;
    }

    public Task<RefreshToken?> GetByHashAsync(
        string tokenHash,
        bool tracked = true,
        CancellationToken cancellationToken = default)
    {
        var query = tracked ? _context.RefreshTokens : _context.RefreshTokens.AsNoTracking();
        return query.FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);
    }

    public async Task<IReadOnlyList<RefreshToken>> GetActiveByAuthorAsync(
        int authorId,
        DateTimeOffset now,
        CancellationToken cancellationToken = default) =>
        await _context.RefreshTokens
            .Where(t => t.AuthorId == authorId && t.RevokedAt == null && t.ExpiresAt > now)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(RefreshToken token, CancellationToken cancellationToken = default) =>
        await _context.RefreshTokens.AddAsync(token, cancellationToken);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);
}
