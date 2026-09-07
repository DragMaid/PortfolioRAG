using Backend.Common;
using Backend.Common.Security;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data;

/// <summary>
/// Development-only sample data. Runs once against an empty database so the API has
/// something to serve — and an account to sign in with — straight after startup.
/// </summary>
public static class BlogDbSeeder
{
    // NOTE: development only, and the in-memory database is thrown away on shutdown.
    // A real deployment registers its first author through POST /api/auth/register.
    public const string DemoEmail = "author@example.com";
    public const string DemoPassword = "ChangeMe!Dev123";

    public static async Task SeedAsync(BlogDbContext context, TimeProvider timeProvider)
    {
        if (await context.Authors.AnyAsync())
            return;

        var now = timeProvider.GetUtcNow();

        var author = new Author
        {
            Name = "Demo Author",
            Email = DemoEmail,
            Biography = "Seeded account for local development.",
            PasswordHash = PasswordHasher.Hash(DemoPassword),
            EmailConfirmedAt = null,
            CreatedAt = now.AddDays(-30)
        };

        var otherAuthor = new Author
        {
            Name = "Second Author",
            Email = "second@example.com",
            Biography = "A second account, so the ownership rules are visible locally.",
            PasswordHash = PasswordHasher.Hash(DemoPassword),
            EmailConfirmedAt = null,
            CreatedAt = now.AddDays(-20)
        };

        context.Authors.AddRange(author, otherAuthor);

        context.Posts.AddRange(
            NewPost(author, "Building a blog API in ASP.NET Core",
                "How the repository, service and controller layers fit together.",
                isDraft: false, now.AddDays(-10)),
            NewPost(author, "Slugs, sorting and paging",
                "Notes on turning titles into URL-friendly identifiers.",
                isDraft: false, now.AddDays(-4)),
            NewPost(author, "Draft: what I want to write next",
                "Only visible to its own author through /api/admin/posts.",
                isDraft: true, now.AddDays(-1)),
            NewPost(otherAuthor, "Draft: someone else's notes",
                "Proves that one author cannot read another's drafts.",
                isDraft: true, now.AddDays(-2)));

        await context.SaveChangesAsync();
    }

    private static Post NewPost(Author author, string title, string summary, bool isDraft, DateTimeOffset created) =>
        new()
        {
            Title = title,
            Slug = SlugGenerator.Generate(title),
            Summary = summary,
            Body = $"# {title}\n\n{summary}\n\nSeeded body text.",
            IsDraft = isDraft,
            Author = author,
            CreatedAt = created,
            UpdatedAt = created,
            PublishedAt = isDraft ? null : created
        };
}
