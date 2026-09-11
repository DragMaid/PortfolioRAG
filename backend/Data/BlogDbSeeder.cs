using Backend.Common;
using Backend.Common.Security;
using Backend.Models.Entities;
using Backend.Services;
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

    /// <param name="storage">
    /// Where the seeded thumbnails and trailers are put. Publishing requires both files, so
    /// a seeded project that is live has to have real objects behind it — see
    /// <see cref="SeedArtwork"/>. When the bucket cannot be reached the projects are seeded
    /// as drafts instead, which is the honest state for a project with no media.
    /// </param>
    public static async Task SeedAsync(
        BlogDbContext context,
        TimeProvider timeProvider,
        IObjectStorage storage,
        ILogger logger)
    {
        if (await context.Authors.AnyAsync())
            return;

        var now = timeProvider.GetUtcNow();

        var author = new Author
        {
            Name = "Demo Author",
            Email = DemoEmail,
            Handle = "demo-author",
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
            Handle = "second-author",
            Biography = "A second account, so the ownership rules are visible locally.",
            PasswordHash = PasswordHasher.Hash(DemoPassword),
            EmailConfirmedAt = null,
            CreatedAt = now.AddDays(-20)
        };

        context.Authors.AddRange(author, otherAuthor);

        var posts = new[]
        {
            NewPost(author, "Aether Engine",
                "Sub-millisecond distributed vector database for real-time semantic retrieval "
                + "at billion-embedding scale.",
                isDraft: false, now.AddDays(-10),
                category: "VECTOR CORE", domain: "Vector Storage",
                repoUrl: "https://github.com/demo/aether-engine",
                demoUrl: "https://demo.invalid/aether",
                specUrl: "https://demo.invalid/aether/rfc",
                isFeatured: true),
            NewPost(author, "Chronos Studio",
                "Collaborative GLSL shader workbench running in WebAssembly with real-time "
                + "state synchronization via CRDTs.",
                isDraft: false, now.AddDays(-6),
                category: "CREATIVE TOOL", domain: "Shader Tooling",
                repoUrl: "https://github.com/demo/chronos-studio",
                demoUrl: "https://demo.invalid/chronos"),
            NewPost(author, "Helios Mesh",
                "Ultra-light edge proxy and network policy supervisor using kernel-level eBPF "
                + "packet inspection.",
                isDraft: false, now.AddDays(-4),
                category: "KERNEL NETWORKING", domain: "Network Mesh",
                repoUrl: "https://github.com/demo/helios-mesh",
                specUrl: "https://demo.invalid/helios/rfc"),
            NewPost(author, "Draft: what I want to build next",
                "Only visible to its own author through /api/admin/posts, and missing the "
                + "thumbnail and trailer that publishing requires.",
                isDraft: true, now.AddDays(-1),
                category: "SCRATCH", domain: "Unfiled"),
            NewPost(otherAuthor, "Draft: someone else's notes",
                "Proves that one author cannot read another's drafts.",
                isDraft: true, now.AddDays(-2),
                category: "SCRATCH", domain: "Unfiled")
        };

        context.Posts.AddRange(posts);

        // NOTE: saved before the media and the readings so the posts have ids to attach them to.
        await context.SaveChangesAsync();

        // Every published project needs both files — that is the rule PublishAsync enforces,
        // and seeded data has no business contradicting it. If the bucket cannot be reached
        // the projects go back to being drafts rather than going live with broken images.
        var published = posts.Where(p => !p.IsDraft).ToArray();

        if (await TryAttachArtworkAsync(context, storage, published, now, logger))
        {
            context.PageViews.AddRange(BuildPageViews(published, now));
        }
        else
        {
            foreach (var post in published)
            {
                post.IsDraft = true;
                post.PublishedAt = null;
            }

            logger.LogWarning(
                "Seeded projects were left as drafts: their artwork could not be stored, and a "
                + "published project must have a thumbnail and a trailer. Configure a storage "
                + "provider and reseed against an empty database to see the landing page populated.");
        }

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Puts a generated thumbnail and trailer in the bucket for each seeded project and
    /// records them. Returns false if the bucket refused any of it, having first put back
    /// whatever it did manage to store.
    /// </summary>
    private static async Task<bool> TryAttachArtworkAsync(
        BlogDbContext context,
        IObjectStorage storage,
        IReadOnlyList<Post> posts,
        DateTimeOffset now,
        ILogger logger)
    {
        var stored = new List<string>();

        try
        {
            for (var index = 0; index < posts.Count; index++)
            {
                var post = posts[index];

                foreach (var (role, content) in new[]
                {
                    (MediaRole.Thumbnail, SeedArtwork.Thumbnail(index)),
                    (MediaRole.Trailer, SeedArtwork.Trailer(index))
                })
                {
                    using (content)
                    {
                        var name = role.ToString().ToLowerInvariant();

                        // The same shape MediaService writes, so the purge-by-prefix sweep
                        // that runs when a post or an account is deleted finds these too.
                        var objectKey =
                            $"authors/{post.AuthorId}/posts/{post.Id}/{Guid.NewGuid():N}-{name}.webp";

                        var blob = await storage.UploadAsync(content, objectKey, "image/webp");
                        stored.Add(blob.ObjectKey);

                        context.Medias.Add(new Media
                        {
                            Filename = $"{name}.webp",
                            ObjectKey = blob.ObjectKey,
                            ByteSize = blob.ByteSize,
                            Extension = MediaExtension.Webp,
                            Role = role,
                            Caption = $"Seeded {name} for {post.Title}.",
                            PostId = post.Id,
                            CreatedAt = now
                        });
                    }
                }
            }

            logger.LogInformation("Seeded {ObjectCount} placeholder object(s) into the bucket.", stored.Count);
            return true;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Could not store the seeded project artwork.");

            // Half a set of artwork is worse than none: the rows are about to be abandoned,
            // so the objects they would have named have to go with them.
            foreach (var objectKey in stored)
            {
                try
                {
                    await storage.DeleteAsync(objectKey);
                }
                catch (Exception cleanup)
                {
                    logger.LogWarning(cleanup, "Could not remove the orphaned seed object {ObjectKey}.", objectKey);
                }
            }

            foreach (var media in context.ChangeTracker.Entries<Media>().ToList())
                media.State = EntityState.Detached;

            return false;
        }
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
        string? category = null,
        string? domain = null,
        string? repoUrl = null,
        string? demoUrl = null,
        string? specUrl = null,
        bool isFeatured = false) =>
        new()
        {
            Title = title,
            Slug = SlugGenerator.Generate(title),
            Summary = summary,
            Body = $"# {title}\n\n{summary}\n\nSeeded body text.",
            IsDraft = isDraft,
            IsFeatured = isFeatured,
            Category = category,
            Domain = domain,
            RepoUrl = repoUrl,
            DemoUrl = demoUrl,
            SpecUrl = specUrl,
            Author = author,
            CreatedAt = created,
            UpdatedAt = created,
            PublishedAt = isDraft ? null : created
        };

    /// <summary>The charted window plus the four weeks its baseline is averaged over.</summary>
    private const int SeededDays = 7 + (7 * 4);
}
