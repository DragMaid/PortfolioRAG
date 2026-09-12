using Backend.Models.Entities;

namespace Backend.Models.DTOs.Auth;

/// <summary>
/// One issued token, as the studio lists it. Deliberately cannot reconstruct the token:
/// <see cref="Prefix"/> is the opening characters only, and the rest exists nowhere but in
/// the hand of whoever it was handed to.
/// </summary>
public class ApiTokenDto
{
    public int Id { get; init; }

    public string Name { get; init; } = string.Empty;

    /// <summary>The first characters of the token, enough to recognise which one this row is.</summary>
    public string Prefix { get; init; } = string.Empty;

    public ApiTokenScope Scope { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    /// <summary>Null for a token that was issued without an expiry.</summary>
    public DateTimeOffset? ExpiresAt { get; init; }

    public DateTimeOffset? LastUsedAt { get; init; }

    public DateTimeOffset? RevokedAt { get; init; }

    /// <summary>
    /// Whether the token would authenticate a request right now. Computed on the server so
    /// the studio does not have to re-derive "expired" from a clock that may disagree.
    /// </summary>
    public bool IsActive { get; init; }
}
