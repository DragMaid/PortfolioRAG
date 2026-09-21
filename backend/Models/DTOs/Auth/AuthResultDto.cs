namespace Backend.Models.DTOs.Auth;

public class AuthResultDto
{
    public string AccessToken { get; init; } = string.Empty;

    public string TokenType { get; init; } = "Bearer";

    /// <summary>Seconds until <see cref="AccessToken"/> expires.</summary>
    public int ExpiresIn { get; init; }

    /// <summary>Single-use: every refresh returns a new one and retires this one.</summary>
    public string RefreshToken { get; init; } = string.Empty;

    /// <summary>
    /// Whether the address on this account has been confirmed. Returned here, rather than
    /// on the public <see cref="AuthorDto"/>, because it is nobody's business but the
    /// account owner's — and they are the only one who ever sees this response.
    /// </summary>
    public bool EmailConfirmed { get; init; }

    public AuthorDto Author { get; init; } = new();
}
