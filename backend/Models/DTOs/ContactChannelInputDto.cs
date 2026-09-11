using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs;

public class ContactChannelInputDto
{
    [Required]
    [StringLength(120, MinimumLength = 1)]
    public string Label { get; init; } = string.Empty;

    [Required]
    [StringLength(500, MinimumLength = 1)]
    public string Url { get; init; } = string.Empty;

    [StringLength(150)]
    public string? Handle { get; init; }

    public int SortOrder { get; init; }
}
