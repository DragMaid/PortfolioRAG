namespace Backend.Models.DTOs;

public class AuthorDto
{
    public int Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public string? AvatarUrl { get; init; }

    public string? Biography { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
