using Backend.Models.DTOs.Auth;
using Backend.Models.Entities;

namespace Backend.Services;

/// <summary>
/// The digits that turn a self-registered address into a confirmed one. Only accounts
/// that signed up with a password ever go through this: an account created through Google
/// arrives with <see cref="Author.EmailConfirmedAt"/> already set, because the provider
/// has vouched for the address.
/// </summary>
public interface IEmailVerificationService
{
    /// <summary>
    /// Issues a code for an account and mails it, retiring whatever code was outstanding.
    /// Refused while the cooldown is running or the daily ceiling is reached.
    /// </summary>
    Task<EmailVerificationChallengeDto> IssueAsync(
        Author author,
        CancellationToken cancellationToken = default);

    /// <summary>The same thing for the signed-in caller, which is what the resend endpoint calls.</summary>
    Task<EmailVerificationChallengeDto> ResendAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirms the caller's address with a code. Returns a fresh token pair, because the
    /// access token carries whether the address is confirmed and the old one says it is not.
    /// </summary>
    Task<AuthResultDto> ConfirmAsync(
        ConfirmEmailDto dto,
        CancellationToken cancellationToken = default);
}
