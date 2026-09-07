using System.ComponentModel.DataAnnotations;
using Backend.Common.Security;

namespace Backend.Models.DTOs.Auth;

public class SetPasswordDto
{
    /// <summary>
    /// Required when the account already has a password. Accounts created through Google
    /// leave this empty to set their first one.
    /// </summary>
    [StringLength(PasswordHasher.MaximumPasswordLength)]
    public string? CurrentPassword { get; init; }

    // TODO: use default password hasher
    [Required]
    [StringLength(PasswordHasher.MaximumPasswordLength, MinimumLength = PasswordHasher.MinimumPasswordLength)]
    public string NewPassword { get; init; } = string.Empty;
}
