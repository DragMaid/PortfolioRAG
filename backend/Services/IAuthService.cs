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
}
