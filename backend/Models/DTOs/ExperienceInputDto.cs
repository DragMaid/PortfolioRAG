using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs;

/// <summary>
/// What an author sends to add or rewrite one job. Create and update take the same fields:
/// nothing about an experience is fixed once it exists, and the logo is a file rather than
/// a field — see PUT /api/experiences/{id}/logo.
/// </summary>
public class ExperienceInputDto
{
    [Required]
    [StringLength(120, MinimumLength = 1)]
    public string Company { get; init; } = string.Empty;

    [Required]
    [StringLength(160, MinimumLength = 1)]
    public string Role { get; init; } = string.Empty;

    [StringLength(200)]
    public string? Team { get; init; }

    [StringLength(4000)]
    public string? Description { get; init; }

    [Required]
    public DateOnly StartedOn { get; init; }

    /// <summary>Leave unset for the current role.</summary>
    public DateOnly? EndedOn { get; init; }
}
