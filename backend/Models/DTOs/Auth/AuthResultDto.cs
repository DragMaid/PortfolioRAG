namespace Backend.Models.DTOs.Auth;

public class AuthResultDto
{
    public string AccessToken { get; init; } = string.Empty;

    public string TokenType { get; init; } = "Bearer";

    /// <summary>Seconds until <see cref="AccessToken"/> expires.</summary>
    public int ExpiresIn { get; init; }

    /// <summary>Single-use: every refresh returns a new one and retires this one.</summary>
    public string RefreshToken { get; init; } = string.Empty;

    public AuthorDto Author { get; init; } = new();
}
