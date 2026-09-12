using System.ComponentModel.DataAnnotations;
using Backend.Models.Entities;

namespace Backend.Models.DTOs.Auth;

public class CreateApiTokenDto
{
    /// <summary>
    /// What this token is for — "ci-deploy", "metrics-bot". Required, because the only
    /// other thing distinguishing two rows is a prefix nobody remembers.
    /// </summary>
    [Required]
    [StringLength(60, MinimumLength = 1)]
    public string Name { get; init; } = string.Empty;

    public ApiTokenScope Scope { get; init; } = ApiTokenScope.Read;

    /// <summary>
    /// How long the token should last. Null issues one that never expires, which is the
    /// caller's to decide — a build box that runs quarterly is worse served by a token that
    /// lapses between runs than by one that outlives its usefulness.
    /// </summary>
    [Range(1, 3650)]
    public int? ExpiresInDays { get; init; }
}
