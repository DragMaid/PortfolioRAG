using System.ComponentModel.DataAnnotations;
using Backend.Common.Security;

namespace Backend.Models.DTOs.Auth;

public class LoginDto
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; init; } = string.Empty;

    // TODO: please use the builtin password hasher instead, implementing it myself wasnt a good idea
    // NOTE: deliberately no MinimumLength here — rejecting a short password with a
    // validation error would tell an attacker the policy applies to a real account.
    [Required]
    [StringLength(PasswordHasher.MaximumPasswordLength)]
    public string Password { get; init; } = string.Empty;
}
