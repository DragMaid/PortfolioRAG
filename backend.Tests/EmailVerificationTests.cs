using Backend.Common.Exceptions;
using Backend.Common.Security;
using Backend.Models.DTOs.Auth;
using Microsoft.AspNetCore.Http;

namespace Backend.Tests;

/// <summary>
/// The digits that stand between signing up with a password and publishing anything.
/// Google accounts appear here only to prove they never go through it.
/// </summary>
public class EmailVerificationTests
{
    private const string Password = "a long enough password";

    private static RegisterDto Registration(string email = "jane@example.com") => new()
    {
        Name = "Jane",
        Email = email,
        Password = Password
    };

    [Fact]
    public async Task Registering_with_a_password_mails_a_code_and_leaves_the_account_unconfirmed()
    {
        await using var harness = await TestHarness.CreateAsync();

        var result = await harness.Auth.RegisterAsync(Registration());

        Assert.False(result.EmailConfirmed);
        Assert.Single(harness.Emails.Sent);
        Assert.Equal("jane@example.com", harness.Emails.Last.ToAddress);

        // Six digits, and nowhere in the database in a form anyone could read back.
        var code = harness.Emails.LastCode;
        Assert.Equal(6, code.Length);

        var stored = harness.Context.EmailVerificationCodes.Single();
        Assert.DoesNotContain(code, stored.CodeHash);
        Assert.Null(harness.Context.Authors.Single().EmailConfirmedAt);
    }

    [Fact]
    public async Task Signing_in_with_Google_never_issues_a_code()
    {
        await using var harness = await TestHarness.CreateAsync();
        harness.Google.Add("token", subject: "google-123", email: "new@example.com", name: "New Person");

        var result = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        // The provider vouched for the address, so there is nothing left to prove.
        Assert.True(result.EmailConfirmed);
        Assert.Empty(harness.Emails.Sent);
        Assert.Empty(harness.Context.EmailVerificationCodes);
    }

    [Fact]
    public async Task A_relay_that_is_down_does_not_fail_the_registration()
    {
        await using var harness = await TestHarness.CreateAsync();
        harness.Emails.FailWith = new InvalidOperationException("relay refused the message");

        // The account is real by the time the send is attempted; telling the caller their
        // sign-up failed would be a lie they could only resolve by trying it again.
        var result = await harness.Auth.RegisterAsync(Registration());

        Assert.NotEmpty(result.AccessToken);
        Assert.Single(harness.Context.Authors);
    }

    [Fact]
    public async Task The_right_code_confirms_the_address_and_re_issues_the_tokens()
    {
        await using var harness = await TestHarness.CreateAsync();

        var registered = await harness.Auth.RegisterAsync(Registration());
        harness.SignIn(registered.Author.Id, registered.Author.Email);

        var confirmed = await harness.Verification.ConfirmAsync(
            new ConfirmEmailDto { Code = harness.Emails.LastCode });

        Assert.True(confirmed.EmailConfirmed);
        Assert.NotEqual(registered.AccessToken, confirmed.AccessToken);
        Assert.NotNull(harness.Context.Authors.Single().EmailConfirmedAt);
    }

    [Fact]
    public async Task A_code_is_good_once()
    {
        await using var harness = await TestHarness.CreateAsync();

        var registered = await harness.Auth.RegisterAsync(Registration());
        harness.SignIn(registered.Author.Id, registered.Author.Email);

        var code = harness.Emails.LastCode;
        await harness.Verification.ConfirmAsync(new ConfirmEmailDto { Code = code });

        // Confirming again is not an error — the caller is already who the code proved they
        // are — but the code itself is spent.
        var again = await harness.Verification.ConfirmAsync(new ConfirmEmailDto { Code = code });
        Assert.True(again.EmailConfirmed);

        var stored = harness.Context.EmailVerificationCodes.Single();
        Assert.NotNull(stored.ConsumedAt);
    }

    [Fact]
    public async Task A_wrong_code_is_counted_and_the_code_dies_at_the_ceiling()
    {
        await using var harness = await TestHarness.CreateAsync();
        harness.EmailVerificationOptions.MaxAttempts = 3;

        var registered = await harness.Auth.RegisterAsync(Registration());
        harness.SignIn(registered.Author.Id, registered.Author.Email);

        var real = harness.Emails.LastCode;
        var wrong = real == "000000" ? "111111" : "000000";

        for (var attempt = 1; attempt < 3; attempt++)
        {
            await Assert.ThrowsAsync<ValidationException>(
                () => harness.Verification.ConfirmAsync(new ConfirmEmailDto { Code = wrong }));
        }

        // The third wrong guess burns the code, so the real one no longer works either.
        await Assert.ThrowsAsync<TooManyRequestsException>(
            () => harness.Verification.ConfirmAsync(new ConfirmEmailDto { Code = wrong }));

        await Assert.ThrowsAsync<ValidationException>(
            () => harness.Verification.ConfirmAsync(new ConfirmEmailDto { Code = real }));

        Assert.Null(harness.Context.Authors.Single().EmailConfirmedAt);
    }

    [Fact]
    public async Task An_expired_code_is_refused()
    {
        await using var harness = await TestHarness.CreateAsync();

        var registered = await harness.Auth.RegisterAsync(Registration());
        harness.SignIn(registered.Author.Id, registered.Author.Email);
        var code = harness.Emails.LastCode;

        harness.TimeProvider.Advance(
            TimeSpan.FromMinutes(harness.EmailVerificationOptions.LifetimeMinutes + 1));

        await Assert.ThrowsAsync<ValidationException>(
            () => harness.Verification.ConfirmAsync(new ConfirmEmailDto { Code = code }));
    }

    [Fact]
    public async Task One_account_cannot_confirm_with_another_account_s_code()
    {
        await using var harness = await TestHarness.CreateAsync();

        var mine = await harness.Auth.RegisterAsync(Registration("mine@example.com"));
        var mineCode = harness.Emails.LastCode;

        var theirs = await harness.Auth.RegisterAsync(Registration("theirs@example.com"));

        harness.SignIn(theirs.Author.Id, theirs.Author.Email);

        await Assert.ThrowsAsync<ValidationException>(
            () => harness.Verification.ConfirmAsync(new ConfirmEmailDto { Code = mineCode }));

        Assert.Null(harness.Context.Authors.Single(a => a.Id == theirs.Author.Id).EmailConfirmedAt);
        Assert.Null(harness.Context.Authors.Single(a => a.Id == mine.Author.Id).EmailConfirmedAt);
    }

    [Fact]
    public async Task A_resend_is_refused_until_the_cooldown_has_run()
    {
        await using var harness = await TestHarness.CreateAsync();

        var registered = await harness.Auth.RegisterAsync(Registration());
        harness.SignIn(registered.Author.Id, registered.Author.Email);

        await Assert.ThrowsAsync<TooManyRequestsException>(
            () => harness.Verification.ResendAsync());

        harness.TimeProvider.Advance(
            TimeSpan.FromSeconds(harness.EmailVerificationOptions.ResendCooldownSeconds + 1));

        var challenge = await harness.Verification.ResendAsync();

        Assert.Equal("jane@example.com", challenge.Email);
        Assert.Equal(2, harness.Emails.Sent.Count);
    }

    [Fact]
    public async Task A_resend_retires_the_code_it_replaces()
    {
        await using var harness = await TestHarness.CreateAsync();

        var registered = await harness.Auth.RegisterAsync(Registration());
        harness.SignIn(registered.Author.Id, registered.Author.Email);

        var first = harness.Emails.LastCode;

        harness.TimeProvider.Advance(
            TimeSpan.FromSeconds(harness.EmailVerificationOptions.ResendCooldownSeconds + 1));

        await harness.Verification.ResendAsync();
        var second = harness.Emails.LastCode;

        // Only what is in the latest mail works; otherwise two codes are live at once and
        // whichever message the owner happens to open first decides whether they get in.
        await Assert.ThrowsAsync<ValidationException>(
            () => harness.Verification.ConfirmAsync(new ConfirmEmailDto { Code = first }));

        var confirmed = await harness.Verification.ConfirmAsync(new ConfirmEmailDto { Code = second });
        Assert.True(confirmed.EmailConfirmed);
    }

    [Fact]
    public async Task An_address_has_a_ceiling_on_the_codes_it_can_be_sent_in_a_day()
    {
        await using var harness = await TestHarness.CreateAsync();
        harness.EmailVerificationOptions.MaxSendsPerDay = 3;

        var registered = await harness.Auth.RegisterAsync(Registration());
        harness.SignIn(registered.Author.Id, registered.Author.Email);

        var cooldown = TimeSpan.FromSeconds(harness.EmailVerificationOptions.ResendCooldownSeconds + 1);

        // One went out with the registration, so two more reach the ceiling.
        harness.TimeProvider.Advance(cooldown);
        await harness.Verification.ResendAsync();
        harness.TimeProvider.Advance(cooldown);
        await harness.Verification.ResendAsync();
        harness.TimeProvider.Advance(cooldown);

        await Assert.ThrowsAsync<TooManyRequestsException>(() => harness.Verification.ResendAsync());
        Assert.Equal(3, harness.Emails.Sent.Count);

        // The ceiling rolls: a day later the account may ask again.
        harness.TimeProvider.Advance(TimeSpan.FromDays(1));
        await harness.Verification.ResendAsync();
        Assert.Equal(4, harness.Emails.Sent.Count);
    }

    [Fact]
    public async Task A_confirmed_account_is_not_sent_more_codes()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync(
            "google@example.com",
            password: null,
            emailConfirmedAt: harness.TimeProvider.GetUtcNow());

        harness.SignIn(author);

        await Assert.ThrowsAsync<ConflictException>(() => harness.Verification.ResendAsync());
        Assert.Empty(harness.Emails.Sent);
    }

    [Fact]
    public async Task Linking_Google_confirms_the_address_without_a_code()
    {
        await using var harness = await TestHarness.CreateAsync();

        var registered = await harness.Auth.RegisterAsync(Registration());
        harness.SignIn(registered.Author.Id, registered.Author.Email);
        harness.Google.Add("token", subject: "google-123", email: "jane@example.com");

        var profile = await harness.Auth.LinkGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        // The other way out of the code screen, and the reason the link endpoint is one of
        // the few an unconfirmed account may still call.
        Assert.True(profile.IsEmailConfirmed);
    }

    /* ---------------------------------------------------------------------- */
    /* What an unconfirmed session may do                                     */
    /* ---------------------------------------------------------------------- */

    [Theory]
    [InlineData("GET")]
    [InlineData("HEAD")]
    [InlineData("OPTIONS")]
    public async Task Reading_is_left_alone(string method)
    {
        var reached = await InvokeMiddlewareAsync(method, confirmed: false);
        Assert.True(reached);
    }

    [Fact]
    public async Task An_unconfirmed_account_cannot_write()
    {
        await Assert.ThrowsAsync<ForbiddenException>(
            () => InvokeMiddlewareAsync("POST", confirmed: false));
    }

    [Fact]
    public async Task An_unconfirmed_account_can_still_reach_the_endpoints_that_unstick_it()
    {
        var reached = await InvokeMiddlewareAsync("POST", confirmed: false, allowUnverified: true);
        Assert.True(reached);
    }

    [Fact]
    public async Task A_confirmed_account_is_unaffected()
    {
        var reached = await InvokeMiddlewareAsync("POST", confirmed: true);
        Assert.True(reached);
    }

    [Fact]
    public async Task An_anonymous_request_is_unaffected()
    {
        // Registration and sign-in are anonymous POSTs, and they are how somebody gets a
        // session in the first place.
        var reached = await InvokeMiddlewareAsync("POST", confirmed: false, signedIn: false);
        Assert.True(reached);
    }

    /// <summary>Runs one request through the middleware; the answer is whether it got past.</summary>
    private static async Task<bool> InvokeMiddlewareAsync(
        string method,
        bool confirmed,
        bool allowUnverified = false,
        bool signedIn = true)
    {
        var reached = false;

        var middleware = new EmailVerificationMiddleware(_ =>
        {
            reached = true;
            return Task.CompletedTask;
        });

        var context = new DefaultHttpContext();
        context.Request.Method = method;

        context.SetEndpoint(new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(
                allowUnverified ? [new AllowUnverifiedEmailAttribute()] : Array.Empty<object>()),
            "test"));

        var currentUser = new StubCurrentUser
        {
            AuthorId = signedIn ? 1 : null,
            IsEmailConfirmed = confirmed
        };

        await middleware.InvokeAsync(context, currentUser);

        return reached;
    }
}
