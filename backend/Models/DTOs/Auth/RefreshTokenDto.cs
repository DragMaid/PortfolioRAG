using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs.Auth;

public class RefreshTokenDto
{
    [Required]
    [StringLength(512, MinimumLength = 1)]
    public string RefreshToken { get; init; } = string.Empty;
}
