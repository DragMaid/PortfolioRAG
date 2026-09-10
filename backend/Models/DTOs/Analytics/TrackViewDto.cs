using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs.Analytics;

public class TrackViewDto
{
    /// <summary>The path that was read, e.g. "/posts/*".</summary>
    [Required]
    [StringLength(400, MinimumLength = 1)]
    public string Path { get; init; } = string.Empty;

    /// <summary>Post slug, set to null if the owner took it down</summary>
    [StringLength(200)]
    public string? Slug { get; init; }

    /// <summary>Where the reader came from, as document.referrer gives it</summary>
    [StringLength(2000)]
    public string? Referrer { get; init; }

    /// <summary>How long the page was open. Clamped to a day: a tab left open all week is not a</summary>
    [Range(0, 86400)]
    public int DwellSeconds { get; init; }
}
