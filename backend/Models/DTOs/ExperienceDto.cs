namespace Backend.Models.DTOs;

public class ExperienceDto
{
    public int Id { get; init; }

    public int AuthorId { get; init; }

    public string Company { get; init; } = string.Empty;

    public string Role { get; init; } = string.Empty;

    public string? Team { get; init; }

    /// <summary>Markdown, as written. Rendering is the reader's side of the wire.</summary>
    public string? Description { get; init; }

    /// <summary>Where to fetch the company mark, or null when none was uploaded.</summary>
    public string? LogoUrl { get; init; }

    public DateOnly StartedOn { get; init; }

    /// <summary>Null while this is the current role.</summary>
    public DateOnly? EndedOn { get; init; }
}
