namespace Backend.Models.Entities;

/// <summary>
/// What a token is allowed to do. Read covers the safe HTTP methods; write covers
/// everything a session can do apart from the account actions that are reserved for the
/// studio — see <c>AuthPolicies.SessionOnly</c>.
/// </summary>
public enum ApiTokenScope
{
    Read = 0,
    Write = 1
}

/// <summary>
/// A long-lived credential an author issues to something that is not a browser — a script,
/// a CI job, a dashboard. Presented as <c>Authorization: Bearer pfl_…</c>.
///
/// Only the hash is persisted, like a refresh token: a database leak hands out nothing
/// usable. Unlike a refresh token it is not single-use and does not rotate on its own,
/// which is why it carries a scope, an optional expiry and a last-used stamp — the three
/// things that make a forgotten one recoverable.
/// </summary>
public class ApiToken
{
    public int Id { get; set; }

    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    /// <summary>What the author called it, so a list of them can be told apart.</summary>
    public string Name { get; set; } = string.Empty;

    public string TokenHash { get; set; } = string.Empty;

    /// <summary>
    /// The opening characters of the raw token, kept in the clear so the studio can show
    /// which token a row is without being able to reconstruct it.
    /// </summary>
    public string Prefix { get; set; } = string.Empty;

    public ApiTokenScope Scope { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Null for a token the author chose never to expire.</summary>
    public DateTimeOffset? ExpiresAt { get; set; }

    /// <summary>
    /// When the token last authenticated a request, or null if it never has. Written at
    /// most once a minute — see <c>ApiTokenAuthenticationHandler</c>.
    /// </summary>
    public DateTimeOffset? LastUsedAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public bool IsActive(DateTimeOffset now) =>
        RevokedAt is null && (ExpiresAt is null || ExpiresAt > now);
}
