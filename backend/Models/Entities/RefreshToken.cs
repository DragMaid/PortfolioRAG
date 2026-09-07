namespace Backend.Models.Entities;

/// <summary>
/// A single-use refresh token. Only the hash is persisted, so a database leak does not
/// hand out usable tokens. Rotation is tracked through <see cref="ReplacedByTokenHash"/>
/// which is what lets replay of an already-spent token be detected.
/// </summary>
public class RefreshToken
{
    public int Id { get; set; }

    public string TokenHash { get; set; } = string.Empty;

    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public string? ReplacedByTokenHash { get; set; }

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;
}
