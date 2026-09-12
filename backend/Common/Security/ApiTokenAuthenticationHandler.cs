using System.Globalization;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Backend.Models.Entities;
using Backend.Repositories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Backend.Common.Security;

/// <summary>
/// Authenticates <c>Authorization: Bearer pfl_…</c> (and the explicit <c>ApiToken pfl_…</c>
/// spelling) against the tokens an author has issued.
/// </summary>
public class ApiTokenAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    // Limit update time every 1 minute only, so user donT spam write requests on db
    private static readonly TimeSpan LastUsedResolution = TimeSpan.FromMinutes(1);

    private readonly IApiTokenRepository _tokens;
    private readonly TimeProvider _timeProvider;

    public ApiTokenAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IApiTokenRepository tokens,
        TimeProvider timeProvider) : base(options, logger, encoder)
    {
        _tokens = tokens;
        _timeProvider = timeProvider;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!TryReadToken(out var rawToken))
            return AuthenticateResult.NoResult();

        var stored = await _tokens.GetByHashAsync(ApiTokenGenerator.Hash(rawToken), tracked: true);

        // NOTE: both revoked or never-existed token gets the same fail error
        if (stored is null)
            return AuthenticateResult.Fail("The API token is not valid.");

        var now = _timeProvider.GetUtcNow();

        if (!stored.IsActive(now))
        {
            Logger.LogInformation(
                "Rejected an inactive API token {TokenId} for author {AuthorId}.",
                stored.Id,
                stored.AuthorId);

            return AuthenticateResult.Fail("The API token is not valid.");
        }

        await TouchAsync(stored, now);

        var identity = new ClaimsIdentity(BuildClaims(stored), AuthSchemes.ApiToken);
        var principal = new ClaimsPrincipal(identity);

        return AuthenticateResult.Success(new AuthenticationTicket(principal, AuthSchemes.ApiToken));
    }

    /// <summary>The raw token out of the Authorization header, under either spelling.</summary>
    private bool TryReadToken(out string rawToken)
    {
        rawToken = string.Empty;

        var header = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(header))
            return false;

        var separator = header.IndexOf(' ');
        if (separator < 0)
            return false;

        var scheme = header[..separator];
        var value = header[(separator + 1)..].Trim();

        // Check scheme for either api token or session
        var recognised =
            scheme.Equals(AuthSchemes.ApiToken, StringComparison.OrdinalIgnoreCase) ||
            scheme.Equals(AuthSchemes.Session, StringComparison.OrdinalIgnoreCase);

        // Validating the above and the api token value
        if (!recognised || !ApiTokenGenerator.LooksLikeApiToken(value))
            return false;

        rawToken = value;
        return true;
    }

    private static IEnumerable<Claim> BuildClaims(ApiToken token) =>
    [
        // The same subject claim a JWT carries, so ICurrentUser and every ownership rule below it cannot tell the difference 
        new Claim(JwtRegisteredClaimNames.Sub, token.AuthorId.ToString(CultureInfo.InvariantCulture)),
        new Claim(JwtRegisteredClaimNames.Email, token.Author.Email),
        new Claim(JwtRegisteredClaimNames.Name, token.Author.Name),
        new Claim(AuthClaims.AuthMethod, AuthMethods.ApiToken),
        new Claim(AuthClaims.ApiTokenScope, token.Scope.ToString()),
        new Claim(AuthClaims.ApiTokenId, token.Id.ToString(CultureInfo.InvariantCulture))
    ];

    private async Task TouchAsync(ApiToken token, DateTimeOffset now)
    {
        if (token.LastUsedAt is { } last && now - last < LastUsedResolution)
            return;


        token.LastUsedAt = now;
        try
        {
            await _tokens.SaveChangesAsync();
        }
        catch (Exception exception)
        {
            // A bookkeeping stamp is not worth failing an otherwise valid request over.
            Logger.LogWarning(exception, "Could not record last use of API token {TokenId}.", token.Id);
        }
    }
}
