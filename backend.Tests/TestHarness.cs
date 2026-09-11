using Backend.Common;
using Backend.Common.Options;
using Backend.Common.Security;
using Backend.Data;
using Backend.Models.Entities;
using Backend.Repositories;
using Backend.Services;
using FileSignatures;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace Backend.Tests;

/// <summary>The caller identity, swapped per test instead of building an HttpContext.</summary>
public sealed class StubCurrentUser : ICurrentUser
{
    public int? AuthorId { get; set; }

    public string? Email { get; set; }

    public bool IsAuthenticated => AuthorId is not null;

    public int RequireAuthorId() =>
        AuthorId ?? throw new Backend.Common.Exceptions.UnauthorizedException("Not signed in.");
}

public sealed class StubHttpContextAccessor : IHttpContextAccessor
{
    public HttpContext? HttpContext { get; set; }
}

/// <summary>Stands in for Google so the linking rules can be exercised without a real token.</summary>
public sealed class StubGoogleTokenValidator : IGoogleTokenValidator
{
    public Dictionary<string, ExternalUserInfo> Tokens { get; } = new();

    public ExternalUserInfo Add(
        string token,
        string subject,
        string email,
        bool emailVerified = true,
        string? name = null)
    {
        var info = new ExternalUserInfo(ExternalLoginProvider.Google, subject, email, emailVerified, name);
        Tokens[token] = info;
        return info;
    }

    public Task<ExternalUserInfo> ValidateAsync(string idToken, CancellationToken cancellationToken = default) =>
        Tokens.TryGetValue(idToken, out var info)
            ? Task.FromResult(info)
            : throw new Backend.Common.Exceptions.UnauthorizedException("The Google ID token could not be verified.");
}

/// <summary>
/// Wires the real services over a Postgres database of this harness's own, so tests
/// exercise the production code paths — and the real schema, with its real constraints and
/// cascades — rather than mocks of them.
/// </summary>
public sealed class TestHarness : IAsyncDisposable
{
    /// <summary>
    /// Builds a harness on a fresh database. Async because the database has to exist first;
    /// see <see cref="PostgresFixture"/>.
    /// </summary>
    public static async Task<TestHarness> CreateAsync(
        Action<MediaOptions>? configureMedia = null,
        CancellationToken cancellationToken = default) =>
        new(await PostgresFixture.CreateDatabaseAsync(cancellationToken), configureMedia);

    /// <summary>
    /// Collecting the format list reflects over an assembly, so it is done once for the test
    /// run rather than once per harness — and a harness is built per test.
    /// </summary>
    private static readonly IFileFormatInspector FormatInspector = new FileFormatInspector();

    private TestHarness(string connectionString, Action<MediaOptions>? configureMedia)
    {
        var options = new DbContextOptionsBuilder<BlogDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        Context = new BlogDbContext(options);
        TimeProvider = new FakeTimeProvider(new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero));
        CurrentUser = new StubCurrentUser();
        Google = new StubGoogleTokenValidator();

        // NOTE: the decorators are inert unless a test sets FailNextSave. They are the only
        // way to make a save fail, which is what the compensating deletes in MediaService
        // are there to survive.
        Authors = new FailingSaveAuthorRepository(new AuthorRepository(Context));
        Posts = new PostRepository(Context);
        RefreshTokens = new RefreshTokenRepository(Context);
        Medias = new FailingSaveMediaRepository(new MediaRepository(Context));
        PageViews = new AnalyticsRepository(Context);

        var jwtOptions = Options.Create(new JwtOptions
        {
            Key = "test-signing-key-that-is-long-enough-for-hs256",
            AccessTokenMinutes = 15,
            RefreshTokenDays = 14
        });

        Tokens = new TokenService(
            RefreshTokens, Authors, TimeProvider, jwtOptions, NullLogger<TokenService>.Instance);

        // NOTE: the defaults allow a 10 MB picture and 50 megapixels. A test that wants to
        // prove a limit is enforced shrinks it here rather than building a file big enough
        // to trip the real one.
        MediaOptions = new MediaOptions();
        configureMedia?.Invoke(MediaOptions);
        var mediaOptions = Options.Create(MediaOptions);

        // NOTE: an in-memory bucket, not the real one. It keeps the bytes, so a test can
        // check what was actually stored rather than trusting the row that points at it.
        Storage = new FakeObjectStorage();

        MediaService = new MediaService(
            Medias,
            Posts,
            Authors,
            Storage,
            new ImageOptimizer(mediaOptions, NullLogger<ImageOptimizer>.Instance),
            new FileSignatureMediaTypeDetector(FormatInspector),
            CurrentUser,
            TimeProvider,
            mediaOptions,
            NullLogger<MediaService>.Instance);

        // NOTE: analytics counts a reader by their address and user agent, which come off the
        // connection rather than the request body. A real HttpContext is the only way to put
        // a caller behind one — see AsVisitor.
        HttpContextAccessor = new StubHttpContextAccessor { HttpContext = new DefaultHttpContext() };
        AsVisitor("203.0.113.1", "test-agent");

        Analytics = new AnalyticsService(
            PageViews,
            Posts,
            CurrentUser,
            HttpContextAccessor,
            TimeProvider,
            Options.Create(new AnalyticsOptions { VisitorSalt = "test-salt", SelfHosts = ["example.com"] }));

        Auth = new AuthService(Authors, Tokens, Google, CurrentUser, TimeProvider);
        PostService = new PostService(Posts, Authors, MediaService, CurrentUser, TimeProvider);
        AuthorService = new AuthorService(Authors, MediaService, CurrentUser, TimeProvider);
    }

    public BlogDbContext Context { get; }

    public FakeTimeProvider TimeProvider { get; }

    public StubCurrentUser CurrentUser { get; }

    public StubGoogleTokenValidator Google { get; }

    public FailingSaveAuthorRepository Authors { get; }

    public IPostRepository Posts { get; }

    public IRefreshTokenRepository RefreshTokens { get; }

    public FailingSaveMediaRepository Medias { get; }

    public IAnalyticsRepository PageViews { get; }

    public IHttpContextAccessor HttpContextAccessor { get; }

    public IAnalyticsService Analytics { get; }

    public FakeObjectStorage Storage { get; }

    public IMediaService MediaService { get; }

    public MediaOptions MediaOptions { get; }

    public ITokenService Tokens { get; }

    public IAuthService Auth { get; }

    public IPostService PostService { get; }

    public IAuthorService AuthorService { get; }

    /// <summary>Adds an author directly, bypassing registration.</summary>
    public async Task<Author> AddAuthorAsync(
        string email,
        string? password = null,
        DateTimeOffset? emailConfirmedAt = null)
    {
        var author = new Author
        {
            Name = email.Split('@')[0],
            Email = email.ToLowerInvariant(),
            // NOTE: unique in the schema, so it cannot be left at the default — two authors
            // added by one test would collide on the empty string rather than on anything
            // the test was trying to say.
            Handle = SlugGenerator.Generate(email.Split('@')[0]) + "-" + Guid.NewGuid().ToString("N")[..8],
            PasswordHash = password is null ? null : PasswordHasher.Hash(password),
            EmailConfirmedAt = emailConfirmedAt,
            CreatedAt = TimeProvider.GetUtcNow()
        };

        Context.Authors.Add(author);
        await Context.SaveChangesAsync();
        return author;
    }

    /// <param name="withArtwork">
    /// Attaches the thumbnail and trailer that <c>PostService.PublishAsync</c> requires.
    /// Off by default: most tests here put a post in a given state directly and care about
    /// ownership, paging or uploads, and two extra media rows would only get in the way of
    /// counting the ones they added themselves. Tests that actually publish ask for it.
    /// </param>
    public async Task<Post> AddPostAsync(
        Author author,
        bool isDraft = true,
        string title = "A post",
        bool isFeatured = false,
        bool withArtwork = false)
    {
        var now = TimeProvider.GetUtcNow();

        var post = new Post
        {
            Title = title,
            Slug = Guid.NewGuid().ToString("N"),
            Body = "body",
            IsDraft = isDraft,
            IsFeatured = isFeatured,
            Author = author,
            CreatedAt = now,
            UpdatedAt = now,
            PublishedAt = isDraft ? null : now
        };

        Context.Posts.Add(post);
        await Context.SaveChangesAsync();

        if (withArtwork)
            await AddArtworkAsync(post);

        return post;
    }

    /// <summary>
    /// Gives a post the thumbnail and trailer publishing insists on. The rows point at keys
    /// the fake bucket holds, so deleting the post sweeps them like any other upload.
    /// </summary>
    public async Task AddArtworkAsync(Post post)
    {
        var now = TimeProvider.GetUtcNow();

        foreach (var role in new[] { MediaRole.Thumbnail, MediaRole.Trailer })
        {
            var name = role.ToString().ToLowerInvariant();
            var objectKey = $"authors/{post.AuthorId}/posts/{post.Id}/{Guid.NewGuid():N}-{name}.webp";

            await Storage.UploadAsync(new MemoryStream(TestFiles.Png()), objectKey, "image/webp");

            Context.Medias.Add(new Media
            {
                Filename = $"{name}.webp",
                ObjectKey = objectKey,
                ByteSize = 64,
                Extension = MediaExtension.Webp,
                Role = role,
                PostId = post.Id,
                CreatedAt = now
            });
        }

        await Context.SaveChangesAsync();
    }

    /// <summary>
    /// Puts the next reading behind this address and user agent. Two readings from different
    /// addresses are two visitors; the same pair on the same day is one.
    /// </summary>
    public void AsVisitor(string ipAddress, string userAgent)
    {
        var context = HttpContextAccessor.HttpContext!;
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(ipAddress);
        context.Request.Headers.UserAgent = userAgent;
    }

    /// <summary>Signs the given author in for the rest of the test.</summary>
    public void SignIn(Author author)
    {
        CurrentUser.AuthorId = author.Id;
        CurrentUser.Email = author.Email;
    }

    /// <summary>The same, for a test that only holds what a registration handed back.</summary>
    public void SignIn(int authorId, string email)
    {
        CurrentUser.AuthorId = authorId;
        CurrentUser.Email = email;
    }

    public void SignOut() => CurrentUser.AuthorId = null;

    public ValueTask DisposeAsync() => Context.DisposeAsync();
}
