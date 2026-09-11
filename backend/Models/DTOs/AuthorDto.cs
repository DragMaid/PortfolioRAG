namespace Backend.Models.DTOs;

/// <summary>
/// An author's public profile: their account, the copy the portfolio is written from, and
/// the two lists that hang off it.
///
/// The lists are embedded rather than fetched separately because the landing page needs
/// all three at once and a portfolio holds a handful of each — three round trips to render
/// one page above the fold would be the more expensive shape, not the tidier one.
/// </summary>
public class AuthorDto
{
    public int Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    /// <summary>The account's public address: this portfolio is served at <c>/{handle}</c>.</summary>
    public string Handle { get; init; } = string.Empty;

    public string? AvatarUrl { get; init; }

    public string? Title { get; init; }

    public string? Headline { get; init; }

    /// <summary>Markdown, as written.</summary>
    public string? Biography { get; init; }

    public string? FooterBio { get; init; }

    public string? Location { get; init; }

    public string? Availability { get; init; }

    public string? Focus { get; init; }

    public string? ContactPitch { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    /// <summary>The timeline, oldest first.</summary>
    public IReadOnlyList<ExperienceDto> Experiences { get; init; } = Array.Empty<ExperienceDto>();

    /// <summary>Contact links in the order the author put them in.</summary>
    public IReadOnlyList<ContactChannelDto> ContactChannels { get; init; } =
        Array.Empty<ContactChannelDto>();
}
