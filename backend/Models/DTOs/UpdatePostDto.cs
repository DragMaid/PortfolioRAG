using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs;

public class UpdatePostDto
{
    [Required]
    [StringLength(200, MinimumLength = 3)]
    public string Title { get; init; } = string.Empty;

    [StringLength(200)]
    [RegularExpression("^[a-z0-9]+(?:-[a-z0-9]+)*$",
        ErrorMessage = "Slug must be lowercase alphanumeric words separated by single hyphens.")]
    public string? Slug { get; init; }

    [StringLength(500)]
    public string? Summary { get; init; }

    [Required]
    [StringLength(50000, MinimumLength = 1)]
    public string Body { get; init; } = string.Empty;

    /// <summary>Whether this is the portfolio's showcase piece</summary>
    public bool IsFeatured { get; init; }

    /// <summary>The kicker beside the ordinal on the card — "VECTOR CORE".</summary>
    [StringLength(60)]
    public string? Category { get; init; }

    /// <summary>The line in the card footer — "Vector Storage".</summary>
    [StringLength(60)]
    public string? Domain { get; init; }

    [StringLength(500)]
    [Url]
    public string? RepoUrl { get; init; }

    [StringLength(500)]
    [Url]
    public string? DemoUrl { get; init; }

    [StringLength(500)]
    [Url]
    public string? SpecUrl { get; init; }
}
