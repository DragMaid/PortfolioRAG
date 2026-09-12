using Backend.Models.DTOs.Auth;

namespace Backend.Services;

public interface IAuthService
{
    Task<AuthResultDto> RegisterAsync(RegisterDto dto, CancellationToken cancellationToken = default);

    Task<AuthResultDto> LoginAsync(LoginDto dto, CancellationToken cancellationToken = default);

    /// <summary>Signs in with a Google ID token, creating or linking the account as needed.</summary>
    Task<AuthResultDto> SignInWithGoogleAsync(GoogleSignInDto dto, CancellationToken cancellationToken = default);

    /// <summary>Attaches a Google account to the caller's existing account.</summary>
    Task<AuthProfileDto> LinkGoogleAsync(GoogleSignInDto dto, CancellationToken cancellationToken = default);

    Task<AuthResultDto> RefreshAsync(RefreshTokenDto dto, CancellationToken cancellationToken = default);

    Task LogoutAsync(RefreshTokenDto dto, CancellationToken cancellationToken = default);

    Task<AuthProfileDto> GetProfileAsync(CancellationToken cancellationToken = default);

    /// <summary>Sets or changes the caller's password and re-issues their tokens.</summary>
    Task<AuthResultDto> SetPasswordAsync(SetPasswordDto dto, CancellationToken cancellationToken = default);

    // API tokens
    /// <summary>Every token the caller has issued, newest first, revoked ones included.</summary>
    Task<IReadOnlyList<ApiTokenDto>> GetApiTokensAsync(CancellationToken cancellationToken = default);

    /// <summary>Issues a token and returns its secret, which is readable this once only.</summary>
    Task<ApiTokenSecretDto> CreateApiTokenAsync(
        CreateApiTokenDto dto,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Replaces a token's secret in place, keeping its name, scope and remaining life. The
    /// old secret stops working the moment this returns.
    /// </summary>
    Task<ApiTokenSecretDto> RotateApiTokenAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Kills a token for good. The row stays, so the list can still show that it existed
    /// and when it was last used.
    /// </summary>
    Task<ApiTokenDto> RevokeApiTokenAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Drops a revoked token's row entirely, once it is of no further interest.</summary>
    Task DeleteApiTokenAsync(int id, CancellationToken cancellationToken = default);
}
