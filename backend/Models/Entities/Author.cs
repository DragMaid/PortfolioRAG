namespace Backend.Models.Entities;

public class Author
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string? AvatarUrl { get; set; }

    public string? Biography { get; set; }

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

    // This one map the blog account with external auth providers
    public ICollection<ExternalLogin> ExternalLogins { get; set; } = new List<ExternalLogin>();

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
