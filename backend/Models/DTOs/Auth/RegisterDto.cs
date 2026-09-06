using System.ComponentModel.DataAnnotations;
using Backend.Common.Security;

namespace Backend.Models.DTOs.Auth;

public class RegisterDto
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; init; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; init; } = string.Empty;

    // TODO: use the default password hasher here also
    [Required]
    [StringLength(PasswordHasher.MaximumPasswordLength, MinimumLength = PasswordHasher.MinimumPasswordLength)]
    public string Password { get; init; } = string.Empty;

    [StringLength(1000)]
    public string? Biography { get; init; }
}
