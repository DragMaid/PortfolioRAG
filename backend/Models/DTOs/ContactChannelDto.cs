namespace Backend.Models.DTOs;

public class ContactChannelDto
{
    public int Id { get; init; }

    public int AuthorId { get; init; }

    public string Label { get; init; } = string.Empty;

    public string Url { get; init; } = string.Empty;

    public string? Handle { get; init; }

    public int SortOrder { get; init; }
}
