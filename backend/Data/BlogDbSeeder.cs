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
            Title = "Staff Systems & Distributed Infrastructure",
            Headline = "Designing high-throughput computing engines, fault-tolerant protocols, "
                + "and quiet, tactile digital interfaces.",
            Biography = "Seeded account for local development.\n\n"
                + "The biography is **Markdown**, so the landing page renders whatever is written "
                + "here — paragraphs, emphasis, links.",
            FooterBio = "Seeded account for local development, so the footer has something to print.",
            Location = "San Francisco, CA (Hybrid)",
            Availability = "Open for Staff roles & select advisory",
            Focus = "Primary focus: Systems / C++ / Rust",
            ContactPitch = "Currently discussing principal/staff infrastructure roles, technical "
                + "advisory engagements, and open source runtime architectures.",
            PasswordHash = PasswordHasher.Hash(DemoPassword),
            EmailConfirmedAt = null,
            CreatedAt = now.AddDays(-30)
        };

        author.Experiences.Add(NewExperience(
            "Stripe",
            "Software Engineer — Core Infrastructure",
            "Global Financial Messaging Layer & Payment Settlement",
            new DateOnly(2019, 5, 1),
            new DateOnly(2021, 9, 1),
            now));

        author.Experiences.Add(NewExperience(
            "Vercel",
            "Senior Systems Engineer",
            "Edge Compute & Global Serverless Gateway",
            new DateOnly(2021, 10, 1),
            new DateOnly(2023, 10, 1),
            now));

        author.Experiences.Add(NewExperience(
            "OpenAI",
            "Staff Infrastructure Architect",
            "AI Research Platform & Distributed Compute Cluster",
            new DateOnly(2023, 11, 1),
            endedOn: null,
            now));

        author.ContactChannels.Add(NewChannel("github.com/demo", "https://github.com/demo", "GitHub (@demo)", 0, now));
        author.ContactChannels.Add(NewChannel(
            "linkedin.com/in/demo", "https://linkedin.com/in/demo", "LinkedIn (/in/demo)", 1, now));
        author.ContactChannels.Add(NewChannel("x.com/demo", "https://x.com/demo", "X / Twitter (@demo)", 2, now));

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

    /// <summary>
    /// A seeded job. The description is Markdown, which is what the timeline renders — the
    /// bullet list is the shape the highlights took before they were free-form copy.
    /// </summary>
    private static Experience NewExperience(
        string company,
        string role,
        string team,
        DateOnly startedOn,
        DateOnly? endedOn,
        DateTimeOffset now) =>
        new()
        {
            Company = company,
            Role = role,
            Team = team,
            Description =
                $"Seeded description for **{company}**.\n\n"
                + "- Something built, with the number that made it matter.\n"
                + "- Something made faster, from what to what.\n"
                + "- Something hardened, and against what.",
            StartedOn = startedOn,
            EndedOn = endedOn,
            CreatedAt = now
        };

    /// <summary>A seeded contact link.</summary>
    private static ContactChannel NewChannel(
        string label,
        string url,
        string handle,
        int sortOrder,
        DateTimeOffset now) =>
        new()
        {
            Label = label,
            Url = url,
            Handle = handle,
            SortOrder = sortOrder,
            CreatedAt = now
        };

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
