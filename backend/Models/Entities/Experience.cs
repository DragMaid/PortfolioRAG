namespace Backend.Models.Entities;

/// <summary> One past or present job on the author's timeline.</summary>
public class Experience
{
    public int Id { get; set; }

    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    public string Company { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    /// <summary>The team or org line under the role — "Edge Compute &amp; Global Serverless Gateway".</summary>
    public string? Team { get; set; }

    /// <summary>What the author did there, in Markdown. Rendered on the public timeline.</summary>
    public string? Description { get; set; }

    // TODO: this private bucket is getting more annoying, we should write a separate module just for preparing link b4hand
    /// <summary>
    /// Where the company mark lives in the bucket, or null when none was uploaded — the
    /// timeline then falls back to a lettermark. A key rather than an address, like every
    /// other upload: readers are redirected through GET /api/experiences/{id}/logo.
    /// </summary>
    public string? LogoObjectKey { get; set; }

    public DateOnly StartedOn { get; set; }

    /// <summary>Null while this is the current role, which is what "Present" is rendered from.</summary>
    public DateOnly? EndedOn { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
