using Backend.Models.DTOs.Auth;
using Backend.Models.Entities;

namespace Backend.Services;

/// <summary>
/// Mints access tokens and owns the lifecycle of refresh tokens.
/// </summary>
public interface ITokenService
{
    /// <summary>Issues a fresh access/refresh pair for an already-authenticated author.</summary>
    Task<AuthResultDto> IssueAsync(Author author, CancellationToken cancellationToken = default);

    /// <summary>
    /// Spends a refresh token and returns its replacement. Presenting a token that was
    /// already spent or revoked revokes every other token the author holds, on the
    /// assumption that it leaked.
    /// </summary>
    Task<AuthResultDto> RotateAsync(string refreshToken, CancellationToken cancellationToken = default);

    /// <summary>Revokes a single refresh token. Unknown tokens are ignored.</summary>
    Task RevokeAsync(string refreshToken, CancellationToken cancellationToken = default);

    /// <summary>Revokes every refresh token an author holds, e.g. after a password change.</summary>
    Task RevokeAllAsync(int authorId, CancellationToken cancellationToken = default);
}
