using Backend.Common.Exceptions;
using Backend.Common.Options;
using Backend.Models.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Services;

/// <summary>
/// Verifies Google ID tokens directly against Google's OpenID configuration. Doing the
/// verification here rather than trusting a decoded payload from the frontend is the whole
/// point: an ID token is only evidence once its signature and audience have been checked.
/// </summary>
public class GoogleTokenValidator : IGoogleTokenValidator
{
    private readonly GoogleAuthOptions _options;
    private readonly ILogger<GoogleTokenValidator> _logger;
    private readonly IConfigurationManager<OpenIdConnectConfiguration> _configurationManager;
    private readonly JsonWebTokenHandler _handler = new();

    public GoogleTokenValidator(
        IOptions<GoogleAuthOptions> options,
        IConfigurationManager<OpenIdConnectConfiguration> configurationManager,
        ILogger<GoogleTokenValidator> logger)
    {
        _options = options.Value;
        _configurationManager = configurationManager;
        _logger = logger;
    }

    public async Task<ExternalUserInfo> ValidateAsync(
        string idToken,
        CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured)
        {
            throw new NotConfiguredException(
                "Google sign-in is not available: 'Authentication:Google:ClientId' has not been configured.");
        }

        OpenIdConnectConfiguration configuration;

        try
        {
            configuration = await _configurationManager.GetConfigurationAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogError(exception, "Could not retrieve Google's OpenID configuration from {Address}.",
                _options.MetadataAddress);
            throw;
        }

        var result = await _handler.ValidateTokenAsync(idToken, new TokenValidationParameters
        {
            ValidIssuers = _options.ValidIssuers,
            ValidAudience = _options.ClientId,
            IssuerSigningKeys = configuration.SigningKeys,
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromMinutes(2)
        });

        if (!result.IsValid)
        {
            _logger.LogInformation(result.Exception, "Rejected a Google ID token.");
            throw new UnauthorizedException("The Google ID token could not be verified.");
        }

        var subject = FindClaim(result, "sub");
        var email = FindClaim(result, "email");

        if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(email))
        {
            throw new UnauthorizedException(
                "The Google ID token is missing the 'sub' or 'email' claim. Request the 'email' scope.");
        }

        return new ExternalUserInfo(
            ExternalLoginProvider.Google,
            subject,
            email.Trim().ToLowerInvariant(),
            IsTrue(FindClaim(result, "email_verified")),
            FindClaim(result, "name"),
            FindClaim(result, "picture"));
    }

    private static string? FindClaim(TokenValidationResult result, string type) =>
        result.ClaimsIdentity?.FindFirst(type)?.Value;

    // NOTE: kinda goofy how each typing has its own TryParse implementation
    // NOTE: Google has shipped email_verified as both a JSON boolean and the string "true".
    private static bool IsTrue(string? value) =>
        bool.TryParse(value, out var parsed) && parsed;
}
