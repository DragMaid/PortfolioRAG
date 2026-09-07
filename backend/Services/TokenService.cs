using System.Security.Cryptography;
using System.Text;
using Backend.Common.Exceptions;
using Backend.Common.Options;
using Backend.Mapping;
using Backend.Models.DTOs.Auth;
using Backend.Models.Entities;
using Backend.Repositories;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Services;

public class TokenService : ITokenService
{
    private const int RefreshTokenBytes = 32;

    private readonly IRefreshTokenRepository _refreshTokens;
    private readonly IAuthorRepository _authors;
    private readonly TimeProvider _timeProvider;
    private readonly JwtOptions _options;
    private readonly ILogger<TokenService> _logger;
    private readonly SigningCredentials _signingCredentials;
    private readonly JsonWebTokenHandler _handler = new();

    public TokenService(
        IRefreshTokenRepository refreshTokens,
        IAuthorRepository authors,
        TimeProvider timeProvider,
        IOptions<JwtOptions> options,
        ILogger<TokenService> logger)
    {
        _refreshTokens = refreshTokens;
        _authors = authors;
        _timeProvider = timeProvider;
        _options = options.Value;
        _logger = logger;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));
        _signingCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    }

    public async Task<AuthResultDto> IssueAsync(Author author, CancellationToken cancellationToken = default)
    {
        var now = _timeProvider.GetUtcNow();
        var (rawRefreshToken, entity) = CreateRefreshToken(author.Id, now);

        await _refreshTokens.AddAsync(entity, cancellationToken);
        await _refreshTokens.SaveChangesAsync(cancellationToken);

        return BuildResult(author, rawRefreshToken, now);
    }

    // This thing use refresh token (A) to generate a new refresh token (B) while also revoking (A)
    public async Task<AuthResultDto> RotateAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var now = _timeProvider.GetUtcNow();
        var stored = await _refreshTokens.GetByHashAsync(HashToken(refreshToken), tracked: true, cancellationToken)
            ?? throw new UnauthorizedException("The refresh token is not valid.");

        if (!stored.IsActive(now))
        {
            // NOTE: if the token has already been replaced and still getting forwarded
            // we assume that a replay attack is being executed and revoke all active tokens
            // this is done because we also assume that the attacker is able to steal the
            // next refresh tokens using the same trick
            if (stored.ReplacedByTokenHash is not null)
            {
                _logger.LogWarning(
                    "Refresh token replay detected for author {AuthorId}; revoking all active tokens.",
                    stored.AuthorId);

                await RevokeAllAsync(stored.AuthorId, cancellationToken);
            }

            throw new UnauthorizedException("The refresh token is not valid.");
        }

        var author = await _authors.GetByIdAsync(stored.AuthorId, tracked: false, cancellationToken)
            ?? throw new UnauthorizedException("The refresh token is not valid.");

        var (rawRefreshToken, replacement) = CreateRefreshToken(author.Id, now);

        stored.RevokedAt = now;
        stored.ReplacedByTokenHash = replacement.TokenHash;

        await _refreshTokens.AddAsync(replacement, cancellationToken);
        await _refreshTokens.SaveChangesAsync(cancellationToken);

        return BuildResult(author, rawRefreshToken, now);
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var stored = await _refreshTokens.GetByHashAsync(HashToken(refreshToken), tracked: true, cancellationToken);

        // NOTE: sign-out is idempotent — an unknown or already dead token is not an error,
        // and reporting one would let a caller probe which tokens exist.
        if (stored is null || stored.RevokedAt is not null)
            return;

        stored.RevokedAt = _timeProvider.GetUtcNow();
        await _refreshTokens.SaveChangesAsync(cancellationToken);
    }

    public async Task RevokeAllAsync(int authorId, CancellationToken cancellationToken = default)
    {
        var now = _timeProvider.GetUtcNow();
        var active = await _refreshTokens.GetActiveByAuthorAsync(authorId, now, cancellationToken);

        if (active.Count == 0)
            return;

        foreach (var token in active)
        {
            token.RevokedAt = now;
        }

        await _refreshTokens.SaveChangesAsync(cancellationToken);
    }

    private AuthResultDto BuildResult(Author author, string rawRefreshToken, DateTimeOffset now)
    {
        var expiresAt = now.AddMinutes(_options.AccessTokenMinutes);

        return new AuthResultDto
        {
            AccessToken = CreateAccessToken(author, now, expiresAt),
            ExpiresIn = _options.AccessTokenMinutes * 60,
            RefreshToken = rawRefreshToken,
            Author = author.ToDto()
        };
    }

    private string CreateAccessToken(Author author, DateTimeOffset issuedAt, DateTimeOffset expiresAt)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            IssuedAt = issuedAt.UtcDateTime,
            NotBefore = issuedAt.UtcDateTime,
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = _signingCredentials,
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = author.Id.ToString(),
                [JwtRegisteredClaimNames.Email] = author.Email,
                [JwtRegisteredClaimNames.Name] = author.Name,
                // NOTE: GUID is .NET term for UUID, then convert to string object
                // the "N" specifier says that the format should have no hyphens "-"
                [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString("N")
            }
        };

        return _handler.CreateToken(descriptor);
    }

    private (string RawToken, RefreshToken Entity) CreateRefreshToken(int authorId, DateTimeOffset now)
    {
        var raw = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(RefreshTokenBytes));

        return (raw, new RefreshToken
        {
            AuthorId = authorId,
            TokenHash = HashToken(raw),
            CreatedAt = now,
            ExpiresAt = now.AddDays(_options.RefreshTokenDays)
        });
    }

    // NOTE: SHA-256 without a salt is right here — the input is 256 bits of entropy we
    // generated, so there is nothing to brute force, and lookups need it to be deterministic.
    private static string HashToken(string rawToken) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}
