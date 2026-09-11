using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs;

// NOTE: the avatar and experience logo are saved in another module
public class UpdateAuthorDto
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; init; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; init; } = string.Empty;

    /// <summary>
    /// The account's public address. Changing it moves the portfolio and breaks the old
    /// link, which is why it is spelled out rather than re-derived from the name on save.
    /// </summary>
    [Required]
    [StringLength(60, MinimumLength = 2)]
    [RegularExpression("^[a-z0-9]+(?:-[a-z0-9]+)*$",
        ErrorMessage = "Handle must be lowercase alphanumeric words separated by single hyphens.")]
    public string Handle { get; init; } = string.Empty;

    [StringLength(150)]
    public string? Title { get; init; }

    [StringLength(400)]
    public string? Headline { get; init; }

    [StringLength(3000)]
    public string? Biography { get; init; }

    [StringLength(500)]
    public string? FooterBio { get; init; }

    [StringLength(120)]
    public string? Location { get; init; }

    [StringLength(160)]
    public string? Availability { get; init; }

    [StringLength(160)]
    public string? Focus { get; init; }

    [StringLength(500)]
    public string? ContactPitch { get; init; }

}
