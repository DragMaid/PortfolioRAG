namespace Backend.Models.Entities;

public enum ExternalLoginProvider
{
    Google = 0
}

/// <summary>
/// Links an author to an account at an external identity provider. The pair
/// (Provider, Subject) is the stable identifier — an address can change, the subject cannot.
/// </summary>
public class ExternalLogin
{
    public int Id { get; set; }

    public ExternalLoginProvider Provider { get; set; }

    // NOTE: the provider's immutable user id ("sub" for Google), never the email.
    public string Subject { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public int AuthorId { get; set; }

    public Author Author { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }
}
