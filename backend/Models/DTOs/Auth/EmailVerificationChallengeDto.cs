namespace Backend.Models.DTOs.Auth;

/// <summary>
/// What the client needs to draw the "enter the code" step: when the code it just asked
/// for dies, and when it may ask for another. Never carries the code itself.
/// </summary>
public class EmailVerificationChallengeDto
{
    /// <summary>The address the code went to.</summary>
    public string Email { get; init; } = string.Empty;

    public int CodeLength { get; init; }

    public DateTimeOffset ExpiresAt { get; init; }

    /// <summary>The earliest a resend will be accepted.</summary>
    public DateTimeOffset ResendAvailableAt { get; init; }

    /// <summary>
    /// False when the API has no mail relay configured and wrote the code to its log
    /// instead. Development only; a deployment with SMTP filled in never sees it.
    /// </summary>
    public bool Delivered { get; init; }
}
