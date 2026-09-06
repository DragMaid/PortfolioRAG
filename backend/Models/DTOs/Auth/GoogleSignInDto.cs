using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs.Auth;

public class GoogleSignInDto
{
    /// <summary>
    /// The ID token (a JWT) handed to the frontend by Google Identity Services. The
    /// backend verifies its signature, issuer and audience itself.
    /// </summary>
    [Required]
    [StringLength(4096, MinimumLength = 1)]
    public string IdToken { get; init; } = string.Empty;
}
