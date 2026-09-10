using Backend.Common;
using Backend.Common.Security;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace Backend.Data;

/// <summary>
/// Development-only sample data. Runs once against an empty database so the API has
/// something to serve — and an account to sign in with — straight after startup.
/// </summary>
public static class BlogDbSeeder
{
    // NOTE: development only. These credentials reach a local container and nothing else —
    // a real deployment registers its first author through POST /api/auth/register.
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

        var posts = new[]
        {
            NewPost(author, "Building a blog API in ASP.NET Core",
                "How the repository, service and controller layers fit together.",
                isDraft: false, now.AddDays(-10),
                isFeatured: true),
            NewPost(author, "Slugs, sorting and paging",
                "Notes on turning titles into URL-friendly identifiers.",
                isDraft: false, now.AddDays(-4),
                isFeatured: false),
            NewPost(author, "Draft: what I want to write next",
                "Only visible to its own author through /api/admin/posts.",
                isDraft: true, now.AddDays(-1),
                isFeatured: false),
            NewPost(otherAuthor, "Draft: someone else's notes",
                "Proves that one author cannot read another's drafts.",
                isDraft: true, now.AddDays(-2),
                isFeatured: false)
        };

        context.Posts.AddRange(posts);

        // NOTE: saved before the readings so the posts have ids to attach them to.
        await context.SaveChangesAsync();

        context.PageViews.AddRange(BuildPageViews(posts.Where(p => !p.IsDraft).ToArray(), now));

        await context.SaveChangesAsync();
    }

    private static IEnumerable<PageView> BuildPageViews(IReadOnlyList<Post> posts, DateTimeOffset now)
    {
        if (posts.Count == 0)
            yield break;

        var random = new Random(Seed: 42);

        string?[] referrers =
        [
            "news.ycombinator.com", "news.ycombinator.com", "news.ycombinator.com",
            "github.com", "github.com",
            "x.com",
            "scholar.google.com",
            null
        ];

        var today = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero);

        for (var dayOffset = SeededDays - 1; dayOffset >= 0; dayOffset--)
        {
            var day = today.AddDays(-dayOffset);
            // weekend will have less views
            var isWeekend = day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
            var readings = isWeekend ? random.Next(4, 10) : random.Next(12, 26);

            // increase views on wednesday (normal dist)
            if (day.DayOfWeek == DayOfWeek.Wednesday)
                readings += random.Next(10, 20);

            for (var i = 0; i < readings; i++)
            {
                // pick a random post to give views to
                var post = posts[random.Next(posts.Count)];

                yield return new PageView
                {
                    PostId = post.Id,
                    AuthorId = post.AuthorId,
                    Path = $"/posts/{post.Slug}",
                    VisitorHash = $"{RandomNumberGenerator.GetBytes(16)}",
                    ReferrerHost = referrers[random.Next(referrers.Length)],
                    DwellSeconds = random.Next(20, 480),
                    OccurredAt = day.AddHours(random.Next(0, 24)).AddMinutes(random.Next(0, 60))
                };
            }
        }
    }

    private static Post NewPost(
        Author author,
        string title,
        string summary,
        bool isDraft,
        DateTimeOffset created,
        bool isFeatured = false,
        params string[] tags) =>
        new()
        {
            Title = title,
            Slug = SlugGenerator.Generate(title),
            Summary = summary,
            Body = $"# {title}\n\n{summary}\n\nSeeded body text.",
            IsDraft = isDraft,
            IsFeatured = isFeatured,
            Author = author,
            CreatedAt = created,
            UpdatedAt = created,
            PublishedAt = isDraft ? null : created
        };

    /// <summary>The charted window plus the four weeks its baseline is averaged over.</summary>
    private const int SeededDays = 7 + (7 * 4);
}
