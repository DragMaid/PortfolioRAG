using Backend.Common.Options;
using Backend.Common.Security;
using Backend.Data;
using Backend.Models.Entities;
using Backend.Repositories;
using Backend.Services;
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
        var info = new ExternalUserInfo(ExternalLoginProvider.Google, subject, email, emailVerified, name, null);
        Tokens[token] = info;
        return info;
    }

    public Task<ExternalUserInfo> ValidateAsync(string idToken, CancellationToken cancellationToken = default) =>
        Tokens.TryGetValue(idToken, out var info)
            ? Task.FromResult(info)
            : throw new Backend.Common.Exceptions.UnauthorizedException("The Google ID token could not be verified.");
}

/// <summary>
/// Wires the real services over an isolated in-memory database, so tests exercise the
/// production code paths rather than mocks of them.
/// </summary>
public sealed class TestHarness : IDisposable
{
    public TestHarness()
    {
        var options = new DbContextOptionsBuilder<BlogDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        Context = new BlogDbContext(options);
        TimeProvider = new FakeTimeProvider(new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero));
        CurrentUser = new StubCurrentUser();
        Google = new StubGoogleTokenValidator();

        Authors = new AuthorRepository(Context);
        Posts = new PostRepository(Context);
        RefreshTokens = new RefreshTokenRepository(Context);

        var jwtOptions = Options.Create(new JwtOptions
        {
            Key = "test-signing-key-that-is-long-enough-for-hs256",
            AccessTokenMinutes = 15,
            RefreshTokenDays = 14
        });

        Tokens = new TokenService(
            RefreshTokens, Authors, TimeProvider, jwtOptions, NullLogger<TokenService>.Instance);

        Auth = new AuthService(Authors, Tokens, Google, CurrentUser, TimeProvider);
        PostService = new PostService(Posts, Authors, CurrentUser, TimeProvider);
        AuthorService = new AuthorService(Authors, CurrentUser);
    }

    public BlogDbContext Context { get; }

    public FakeTimeProvider TimeProvider { get; }

    public StubCurrentUser CurrentUser { get; }

    public StubGoogleTokenValidator Google { get; }

    public IAuthorRepository Authors { get; }

    public IPostRepository Posts { get; }

    public IRefreshTokenRepository RefreshTokens { get; }

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
            // TODO: use default hasher instead
            PasswordHash = password is null ? null : PasswordHasher.Hash(password),
            EmailConfirmedAt = emailConfirmedAt,
            CreatedAt = TimeProvider.GetUtcNow()
        };

        Context.Authors.Add(author);
        await Context.SaveChangesAsync();
        return author;
    }

    public async Task<Post> AddPostAsync(Author author, bool isDraft = true, string title = "A post")
    {
        var now = TimeProvider.GetUtcNow();

        var post = new Post
        {
            Title = title,
            Slug = Guid.NewGuid().ToString("N"),
            Body = "body",
            IsDraft = isDraft,
            Author = author,
            CreatedAt = now,
            UpdatedAt = now,
            PublishedAt = isDraft ? null : now
        };

        Context.Posts.Add(post);
        await Context.SaveChangesAsync();
        return post;
    }

    /// <summary>Signs the given author in for the rest of the test.</summary>
    public void SignIn(Author author)
    {
        CurrentUser.AuthorId = author.Id;
        CurrentUser.Email = author.Email;
    }

    public void SignOut() => CurrentUser.AuthorId = null;

    public void Dispose() => Context.Dispose();
}
