using Backend.Common.Security;
using Backend.Models.DTOs.Auth;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Account and session endpoints. Everything here is anonymous except the endpoints that
/// act on the caller's own account, which need a bearer access token.
/// </summary>
[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>Creates an author account with a password and signs it in.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResultDto>> Register(
        [FromBody] RegisterDto dto,
        CancellationToken cancellationToken)
    {
        var result = await _authService.RegisterAsync(dto, cancellationToken);
        return Created($"/api/authors/{result.Author.Id}", result);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResultDto>> Login(
        [FromBody] LoginDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _authService.LoginAsync(dto, cancellationToken));

    /// <summary>
    /// Exchanges a Google ID token for this API's tokens. Creates the account on first use,
    /// or attaches to an existing one when the address is safe to adopt.
    /// </summary>
    [HttpPost("oauth/google")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<AuthResultDto>> GoogleSignIn(
        [FromBody] GoogleSignInDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _authService.SignInWithGoogleAsync(dto, cancellationToken));

    /// <summary>Adds Google as a sign-in method for the account making the request.</summary>
    [HttpPost("oauth/google/link")]
    [Authorize]
    [SessionOnly]
    [ProducesResponseType(typeof(AuthProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<AuthProfileDto>> LinkGoogle(
        [FromBody] GoogleSignInDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _authService.LinkGoogleAsync(dto, cancellationToken));

    /// <summary>Trades a refresh token for a new pair. The presented token is spent.</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResultDto>> Refresh(
        [FromBody] RefreshTokenDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _authService.RefreshAsync(dto, cancellationToken));

    /// <summary>Revokes a refresh token. Succeeds even if the token was already dead.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Logout(
        [FromBody] RefreshTokenDto dto,
        CancellationToken cancellationToken)
    {
        await _authService.LogoutAsync(dto, cancellationToken);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(AuthProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthProfileDto>> Me(CancellationToken cancellationToken) =>
        Ok(await _authService.GetProfileAsync(cancellationToken));

    /// <summary>
    /// Sets or changes the caller's password. Every other session is signed out and a new
    /// token pair is returned to this one.
    /// </summary>
    [HttpPost("password")]
    [Authorize]
    [SessionOnly]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResultDto>> SetPassword(
        [FromBody] SetPasswordDto dto,
        CancellationToken cancellationToken) =>
        Ok(await _authService.SetPasswordAsync(dto, cancellationToken));

    /// API routes
    /// <summary>Lists the API tokens on your account. Secrets are never included.</summary>
    [HttpGet("tokens")]
    [Authorize]
    [SessionOnly]
    [ProducesResponseType(typeof(IReadOnlyList<ApiTokenDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<ApiTokenDto>>> ListApiTokens(
        CancellationToken cancellationToken) =>
        Ok(await _authService.GetApiTokensAsync(cancellationToken));

    /// <summary>
    /// Issues an API token. The response carries the only copy of the secret there will
    /// ever be — the API stores a hash of it and cannot show it again.
    /// </summary>
    [HttpPost("tokens")]
    [Authorize]
    [SessionOnly]
    [ProducesResponseType(typeof(ApiTokenSecretDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiTokenSecretDto>> CreateApiToken(
        [FromBody] CreateApiTokenDto dto,
        CancellationToken cancellationToken)
    {
        var result = await _authService.CreateApiTokenAsync(dto, cancellationToken);
        return Created($"/api/auth/tokens/{result.Token.Id}", result);
    }

    /// <summary>
    /// Replaces a token's secret, keeping its name, scope and expiry. Whatever holds the
    /// old secret stops working immediately.
    /// </summary>
    [HttpPost("tokens/{id:int}/rotate")]
    [Authorize]
    [SessionOnly]
    [ProducesResponseType(typeof(ApiTokenSecretDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiTokenSecretDto>> RotateApiToken(
        int id,
        CancellationToken cancellationToken) =>
        Ok(await _authService.RotateApiTokenAsync(id, cancellationToken));

    /// <summary>Revokes a token. Idempotent, and the row stays on the list as revoked.</summary>
    [HttpPost("tokens/{id:int}/revoke")]
    [Authorize]
    [SessionOnly]
    [ProducesResponseType(typeof(ApiTokenDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiTokenDto>> RevokeApiToken(
        int id,
        CancellationToken cancellationToken) =>
        Ok(await _authService.RevokeApiTokenAsync(id, cancellationToken));

    /// <summary>Removes a revoked token from the list. Refused while it is still active.</summary>
    [HttpDelete("tokens/{id:int}")]
    [Authorize]
    [SessionOnly]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteApiToken(int id, CancellationToken cancellationToken)
    {
        await _authService.DeleteApiTokenAsync(id, cancellationToken);
        return NoContent();
    }
}
