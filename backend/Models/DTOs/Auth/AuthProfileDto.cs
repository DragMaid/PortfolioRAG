using Backend.Models.Entities;

namespace Backend.Models.DTOs.Auth;

/// <summary>
/// The signed-in author's own view of their account — everything AuthorDto exposes plus
/// the sign-in methods attached to it. Only ever returned to the account owner.
/// </summary>
public class AuthProfileDto
{
    public int Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public string? AvatarUrl { get; init; }

    public string? Biography { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public bool HasPassword { get; init; }

    public bool IsEmailConfirmed { get; init; }

    public IReadOnlyList<ExternalLoginProvider> LinkedProviders { get; init; } =
        Array.Empty<ExternalLoginProvider>();
}
