using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs.Auth;

public class ConfirmEmailDto
{
    /// <summary>The digits from the message. Length is checked against the configured one.</summary>
    [Required]
    [StringLength(9, MinimumLength = 4)]
    public string Code { get; init; } = string.Empty;
}
