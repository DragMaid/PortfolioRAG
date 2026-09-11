namespace Backend.Models.Entities;

public class Author
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    /// <summary>Public identifier of a user, derived from the name.</summary>
    public string Handle { get; set; } = string.Empty;

    /// <summary>
    /// Where the account's avatar lives in the bucket, or null when it never uploaded one.
    /// The only source of an avatar: the bucket is private, so this is a key rather than an
    /// address, and readers are redirected through GET /api/authors/{id}/avatar.
    /// </summary>
    public string? AvatarObjectKey { get; set; }

    /// <summary>
    /// The line under the name — "Staff Systems &amp; Distributed Infrastructure".
    /// </summary>
    public string? Title { get; set; }

    /// <summary>The large statement at the top of the biography card.</summary>
    public string? Headline { get; set; }

    /// <summary>Long-form self-description, in Markdown.</summary>
    public string? Biography { get; set; }

    /// <summary>The condensed biography the footer prints, in plain text.</summary>
    public string? FooterBio { get; set; }

    public string? Location { get; set; }

    /// <summary>What the author is open to, beside the status dot.</summary>
    public string? Availability { get; set; }

    /// <summary>The note at the foot of the profile card — "Primary focus: Systems / C++ / Rust".</summary>
    public string? Focus { get; set; }

    /// <summary>The copy under "Initiate a conversation".</summary>
    public string? ContactPitch { get; set; }

    // NOTE: null for accounts that only ever signed in through an external provider.
    // Those accounts get a password the first time they call POST /api/auth/password.
    public string? PasswordHash { get; set; }

    // TODO: hear me out this might seem dumb but it would be kinda cool to implement
    // generic identity like IPrinciple from ASP.NET 
    // NOTE: set when an identity provider has vouched for the address (Google with
    // email_verified). A locally registered account stays unconfirmed, which is what
    // stops an external login from silently taking it over. See AuthService.
    public DateTimeOffset? EmailConfirmedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Post> Posts { get; set; } = new List<Post>();

    /// <summary>The jobs on the author's timeline, oldest first.</summary>
    public ICollection<Experience> Experiences { get; set; } = new List<Experience>();

    /// <summary>Every way of reaching the author, in the order they chose.</summary>
    public ICollection<ContactChannel> ContactChannels { get; set; } = new List<ContactChannel>();

    // This one map the blog account with external auth providers
    public ICollection<ExternalLogin> ExternalLogins { get; set; } = new List<ExternalLogin>();

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
