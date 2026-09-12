namespace Backend.Models.DTOs.Auth;

/// <summary>
/// The answer to creating or rotating a token: the row, plus the one and only time the
/// raw token is ever readable. Nothing stores it — the API keeps a hash, and if the caller
/// loses it the only way back is to rotate again.
/// </summary>
public class ApiTokenSecretDto
{
    public ApiTokenDto Token { get; init; } = new();

    /// <summary>The value to send as <c>Authorization: Bearer …</c>. Shown once.</summary>
    public string Secret { get; init; } = string.Empty;
}
