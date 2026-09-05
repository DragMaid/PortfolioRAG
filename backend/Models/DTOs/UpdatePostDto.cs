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
}
