namespace Backend.Models.Entities;

/// <summary>
/// A short numeric code emailed to an address an account claims but nothing has vouched
/// for yet. Only a hash is stored, so a database leak hands out no working codes — the
/// same reasoning as <see cref="RefreshToken"/>, but the input here is six digits rather
/// than 256 bits, which is why the hash is a slow one and <see cref="Attempts"/> is
/// counted. See <c>VerificationCode</c>.
/// </summary>
public class EmailVerificationCode
{
    public int Id { get; set; }

    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    /// <summary>
    /// The address the code went to. Kept because a code proves that address and not
    /// whatever the account carries by the time it comes back.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    public string CodeHash { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    /// <summary>When the code was spent. A code is good for exactly one confirmation.</summary>
    public DateTimeOffset? ConsumedAt { get; set; }

    /// <summary>
    /// Wrong guesses so far. Six digits is a million tries for somebody who can spend them,
    /// so the code dies once this reaches the configured ceiling.
    /// </summary>
    public int Attempts { get; set; }

    public bool IsActive(DateTimeOffset now) => ConsumedAt is null && ExpiresAt > now;
}
