using Backend.Common.Security;

namespace Backend.Common.Options;

/// <summary>
/// How long a verification code lives and how hard it may be guessed at. Only registration
/// with a password ever issues one — an account that arrives through Google comes with its
/// address already vouched for, so there is nothing to confirm.
/// </summary>
public class EmailVerificationOptions
{
    public const string SectionName = "EmailVerification";

    public int CodeLength { get; set; } = 6;

    /// <summary>
    /// Short enough that a code read off a screen behind somebody is worthless by the time
    /// they could use it, long enough to survive a slow mail hop.
    /// </summary>
    public int LifetimeMinutes { get; set; } = 15;

    /// <summary>Wrong guesses a single code tolerates before it is burned.</summary>
    public int MaxAttempts { get; set; } = 5;

    /// <summary>
    /// How long after a send the next one is refused. Stops the endpoint being used to
    /// post mail at somebody else's address on repeat.
    /// </summary>
    public int ResendCooldownSeconds { get; set; } = 60;

    /// <summary>Codes one account may be sent in a rolling day, resends included.</summary>
    public int MaxSendsPerDay { get; set; } = 10;

    public void Validate()
    {
        if (CodeLength is < VerificationCode.MinimumLength
                       or > VerificationCode.MaximumLength)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:CodeLength' must be between " +
                $"{VerificationCode.MinimumLength} and {VerificationCode.MaximumLength}.");
        }

        if (LifetimeMinutes <= 0 || MaxAttempts <= 0 || MaxSendsPerDay <= 0)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:LifetimeMinutes', '{SectionName}:MaxAttempts' and " +
                $"'{SectionName}:MaxSendsPerDay' must all be positive.");
        }

        if (ResendCooldownSeconds < 0)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:ResendCooldownSeconds' cannot be negative.");
        }
    }
}
