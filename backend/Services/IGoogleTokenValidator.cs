using Backend.Models.Entities;

namespace Backend.Services;

/// <summary>What an identity provider told us about the person signing in.</summary>
public sealed record ExternalUserInfo(
    ExternalLoginProvider Provider,
    string Subject,
    string Email,
    bool EmailVerified,
    string? Name);

public interface IGoogleTokenValidator
{
    /// <summary>
    /// Verifies a Google ID token's signature, issuer, audience and lifetime against
    /// Google's published keys.
    /// </summary>
    Task<ExternalUserInfo> ValidateAsync(string idToken, CancellationToken cancellationToken = default);
}
