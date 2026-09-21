using Backend.Data;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Repositories;

public class EmailVerificationRepository : IEmailVerificationRepository
{
    private readonly BlogDbContext _context;

    public EmailVerificationRepository(BlogDbContext context)
    {
        _context = context;
    }

    public Task<EmailVerificationCode?> GetActiveAsync(
        int authorId,
        DateTimeOffset now,
        bool tracked = false,
        CancellationToken cancellationToken = default)
    {
        var query = tracked
            ? _context.EmailVerificationCodes
            : _context.EmailVerificationCodes.AsNoTracking();

        return query
            .Where(c => c.AuthorId == authorId && c.ConsumedAt == null && c.ExpiresAt > now)
            .OrderByDescending(c => c.CreatedAt)
            .ThenByDescending(c => c.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task<EmailVerificationCode?> GetLatestAsync(
        int authorId,
        CancellationToken cancellationToken = default) =>
        _context.EmailVerificationCodes
            .AsNoTracking()
            .Where(c => c.AuthorId == authorId)
            .OrderByDescending(c => c.CreatedAt)
            .ThenByDescending(c => c.Id)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<int> CountSentSinceAsync(
        int authorId,
        DateTimeOffset since,
        CancellationToken cancellationToken = default) =>
        _context.EmailVerificationCodes
            .CountAsync(c => c.AuthorId == authorId && c.CreatedAt >= since, cancellationToken);

    public async Task InvalidateAllAsync(
        int authorId,
        DateTimeOffset now,
        CancellationToken cancellationToken = default) =>
        // NOTE: stamped rather than deleted, so the row still says a code was sent and when
        // — which is exactly what the daily ceiling and the resend cooldown count.
        await _context.EmailVerificationCodes
            .Where(c => c.AuthorId == authorId && c.ConsumedAt == null)
            .ExecuteUpdateAsync(c => c.SetProperty(x => x.ConsumedAt, now), cancellationToken);

    public async Task AddAsync(EmailVerificationCode code, CancellationToken cancellationToken = default) =>
        await _context.EmailVerificationCodes.AddAsync(code, cancellationToken);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);
}
