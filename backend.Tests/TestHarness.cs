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

    /// <summary>
    /// Defaults to false — a session, which is what most tests mean by "signed in". A test
    /// about what a token may not do sets this and <see cref="ApiTokenScope"/> together.
    /// </summary>
    public bool IsApiToken { get; set; }

    public ApiTokenScope? ApiTokenScope { get; set; }

    /// <summary>
    /// Defaults to true — most tests are about something other than confirmation, and an
    /// account that cannot write would fail them for the wrong reason. The tests that are
    /// about it set it false.
    /// </summary>
    public bool IsEmailConfirmed { get; set; } = true;

    public int RequireAuthorId() =>
        AuthorId ?? throw new Backend.Common.Exceptions.UnauthorizedException("Not signed in.");
}

/// <summary>
/// A fixed visitor hash, so a test can say "the same reader again" or "somebody else"
/// without constructing two HttpContexts with different addresses.
/// </summary>
public sealed class StubVisitorFingerprint : IVisitorFingerprint
{
    public string Value { get; set; } = "visitor-one";

    public string Compute(DateTimeOffset now) => Value;
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
/// Keeps the mail instead of sending it, so a test can read the code out of the body the
/// way the account owner would read it out of their inbox.
/// </summary>
public sealed class FakeEmailSender : IEmailSender
{
    public List<EmailMessage> Sent { get; } = new();

    /// <summary>Whether the harness is pretending a relay is configured. See LoggingEmailSender.</summary>
    public bool IsConfigured { get; set; } = true;

    /// <summary>Set to make the next send throw — a relay that is down, or refusing.</summary>
    public Exception? FailWith { get; set; }

    public EmailMessage Last => Sent.Count > 0
        ? Sent[^1]
        : throw new InvalidOperationException("No message has been sent.");

    /// <summary>The digits out of the most recent message.</summary>
    public string LastCode =>
        System.Text.RegularExpressions.Regex.Match(Last.TextBody, @"\b\d{4,9}\b").Value;

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        if (FailWith is not null)
            throw FailWith;

        Sent.Add(message);
        return Task.CompletedTask;
    }
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
        ApiTokens = new ApiTokenRepository(Context);
        VerificationCodes = new EmailVerificationRepository(Context);
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

        // NOTE: the real fingerprint, not the stub, because the analytics tests are about
        // counting distinct readers and a constant hash would make every one of them one
        // reader. The stub exists for the job-fit tests, which need the opposite.
        var analyticsOptions = Options.Create(
            new AnalyticsOptions { VisitorSalt = "test-salt", SelfHosts = ["example.com"] });

        Analytics = new AnalyticsService(
            PageViews,
            Posts,
            CurrentUser,
            HttpContextAccessor,
            new VisitorFingerprint(HttpContextAccessor, analyticsOptions),
            TimeProvider,
            analyticsOptions);

        Emails = new FakeEmailSender();

        EmailVerificationOptions = new EmailVerificationOptions();

        Verification = new EmailVerificationService(
            VerificationCodes,
            Authors,
            Tokens,
            Emails,
            CurrentUser,
            TimeProvider,
            Options.Create(EmailVerificationOptions),
            NullLogger<EmailVerificationService>.Instance);

        Auth = new AuthService(
            Authors,
            ApiTokens,
            Tokens,
            Google,
            CurrentUser,
            Verification,
            TimeProvider,
            NullLogger<AuthService>.Instance);

        // ------------------------------------------------------------------
        // Retrieval
        // ------------------------------------------------------------------

        Rag = new RagRepository(Context);
        IndexScheduler = new RagIndexScheduler(Rag, TimeProvider);

        PostService = new PostService(Posts, Authors, MediaService, IndexScheduler, CurrentUser, TimeProvider);
        AuthorService = new AuthorService(Authors, MediaService, IndexScheduler, CurrentUser, TimeProvider);

        // A fixed 32-byte key. Its value is the one thing that has to agree with the
        // interop fixture in rag/tests/test_crypto_interop.py — see the note there.
        LlmOptions = new LlmOptions
        {
            EncryptionKey = Convert.ToBase64String(
                System.Text.Encoding.UTF8.GetBytes("test-only-fixed-key-32-bytes!!!!")),
            MaxJobDescriptionChars = 20000
        };

        var llmOptions = Options.Create(LlmOptions);

        Protector = new SecretProtector(llmOptions);

        // NOTE: no HTTP. The provider is a stub a test can make accept, reject or be
        // unreachable, because those three answers lead to three different behaviours and
        // only one of them can be produced by a real key.
        Provider = new StubLlmProviderValidator();
        Visitors = new StubVisitorFingerprint();

        LlmCredentials = new LlmCredentialService(
            Rag,
            IndexScheduler,
            CurrentUser,
            Protector,
            new LlmProviderRegistry([Provider]),
            TimeProvider,
            llmOptions,
            NullLogger<LlmCredentialService>.Instance);

        JobFit = new JobFitService(
            Rag,
            Authors,
            Visitors,
            TimeProvider,
            llmOptions,
            NullLogger<JobFitService>.Instance);
    }

    public BlogDbContext Context { get; }

    public FakeTimeProvider TimeProvider { get; }

    public StubCurrentUser CurrentUser { get; }

    public StubGoogleTokenValidator Google { get; }

    public FailingSaveAuthorRepository Authors { get; }

    public IPostRepository Posts { get; }

    public IRefreshTokenRepository RefreshTokens { get; }

    public IApiTokenRepository ApiTokens { get; }

    public IEmailVerificationRepository VerificationCodes { get; }

    public FakeEmailSender Emails { get; }

    public EmailVerificationOptions EmailVerificationOptions { get; }

    public IEmailVerificationService Verification { get; }

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

    public IRagRepository Rag { get; }

    public IRagIndexScheduler IndexScheduler { get; }

    public LlmOptions LlmOptions { get; }

    public ISecretProtector Protector { get; }

    public StubLlmProviderValidator Provider { get; }

    public StubVisitorFingerprint Visitors { get; }

    public ILlmCredentialService LlmCredentials { get; }

    public IJobFitService JobFit { get; }

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
