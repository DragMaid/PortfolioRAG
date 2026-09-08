using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs;

public class UpdateAuthorDto
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; init; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; init; } = string.Empty;

    [StringLength(1000)]
    public string? Biography { get; init; }

    // NOTE: the avatar is not part of this. It is a file, not a field — see
    // PUT /api/authors/me/avatar.
}
