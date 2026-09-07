using Backend.Common.Exceptions;
using Backend.Models.DTOs.Auth;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

public class AuthServiceTests
{
    private const string Password = "a long enough password";

    [Fact]
    public async Task Register_creates_an_account_and_signs_it_in()
    {
        using var harness = new TestHarness();

        var result = await harness.Auth.RegisterAsync(new RegisterDto
        {
            Name = "  Jane  ",
            Email = "  Jane@Example.COM ",
            Password = Password
        });

        Assert.NotEmpty(result.AccessToken);
        Assert.Equal("jane@example.com", result.Author.Email);
        Assert.Equal("Jane", result.Author.Name);

        var stored = harness.Context.Authors.Single();
        Assert.NotNull(stored.PasswordHash);
        Assert.NotEqual(Password, stored.PasswordHash);
        // A self-registered address is unconfirmed; that is what blocks a Google takeover.
        Assert.Null(stored.EmailConfirmedAt);
    }

    [Fact]
    public async Task Register_refuses_an_address_that_is_already_taken()
    {
        using var harness = new TestHarness();
        await harness.AddAuthorAsync("taken@example.com", Password);

        await Assert.ThrowsAsync<ConflictException>(() => harness.Auth.RegisterAsync(new RegisterDto
        {
            Name = "Impostor",
            Email = "TAKEN@example.com",
            Password = Password
        }));
    }

    [Fact]
    public async Task Login_accepts_the_right_password()
    {
        using var harness = new TestHarness();
        await harness.AddAuthorAsync("jane@example.com", Password);

        var result = await harness.Auth.LoginAsync(new LoginDto { Email = "Jane@Example.com", Password = Password });

        Assert.NotEmpty(result.AccessToken);
        Assert.NotEmpty(result.RefreshToken);
    }

    [Fact]
    public async Task Login_rejects_a_wrong_password_and_an_unknown_address_identically()
    {
        using var harness = new TestHarness();
        await harness.AddAuthorAsync("jane@example.com", Password);

        var wrong = await Assert.ThrowsAsync<UnauthorizedException>(
            () => harness.Auth.LoginAsync(new LoginDto { Email = "jane@example.com", Password = "wrong password" }));
        var unknown = await Assert.ThrowsAsync<UnauthorizedException>(
            () => harness.Auth.LoginAsync(new LoginDto { Email = "nobody@example.com", Password = "wrong password" }));

        Assert.Equal(wrong.Message, unknown.Message);
    }

    [Fact]
    public async Task Login_refuses_an_account_that_has_no_password()
    {
        using var harness = new TestHarness();
        await harness.AddAuthorAsync("google-only@example.com", password: null);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            harness.Auth.LoginAsync(new LoginDto { Email = "google-only@example.com", Password = Password }));
    }

    [Fact]
    public async Task Google_sign_in_creates_an_account_the_first_time()
    {
        using var harness = new TestHarness();
        harness.Google.Add("token", subject: "google-123", email: "new@example.com", name: "New Person");

        var result = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        Assert.Equal("new@example.com", result.Author.Email);
        Assert.Equal("New Person", result.Author.Name);

        var author = harness.Context.Authors.Single();
        Assert.Null(author.PasswordHash);
        Assert.NotNull(author.EmailConfirmedAt);

        var link = harness.Context.ExternalLogins.Single();
        Assert.Equal(ExternalLoginProvider.Google, link.Provider);
        Assert.Equal("google-123", link.Subject);
        Assert.Equal(author.Id, link.AuthorId);
    }

    [Fact]
    public async Task Google_sign_in_falls_back_to_the_address_when_no_name_is_supplied()
    {
        using var harness = new TestHarness();
        harness.Google.Add("token", "google-123", "someone@example.com", name: null);

        var result = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        Assert.Equal("someone", result.Author.Name);
    }

    [Fact]
    public async Task Google_sign_in_returns_to_the_same_account_on_the_second_visit()
    {
        using var harness = new TestHarness();
        harness.Google.Add("token", "google-123", "new@example.com");

        var first = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });
        var second = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        Assert.Equal(first.Author.Id, second.Author.Id);
        Assert.Single(harness.Context.Authors);
        Assert.Single(harness.Context.ExternalLogins);
    }

    [Fact]
    public async Task Google_sign_in_follows_the_subject_when_the_address_changes()
    {
        using var harness = new TestHarness();
        harness.Google.Add("token", "google-123", "old@example.com");
        var first = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        harness.Google.Add("token", "google-123", "renamed@example.com");
        var second = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        Assert.Equal(first.Author.Id, second.Author.Id);
        Assert.Single(harness.Context.Authors);
        Assert.Equal("renamed@example.com", harness.Context.ExternalLogins.Single().Email);
    }

    [Fact]
    public async Task Google_sign_in_refuses_an_unverified_address()
    {
        using var harness = new TestHarness();
        harness.Google.Add("token", "google-123", "unverified@example.com", emailVerified: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" }));

        Assert.Empty(harness.Context.Authors);
    }

    [Fact]
    public async Task Google_sign_in_refuses_a_token_it_cannot_verify()
    {
        using var harness = new TestHarness();

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "forged" }));
    }

    [Fact]
    public async Task Google_sign_in_will_not_adopt_an_unconfirmed_password_account()
    {
        // The takeover this guards against: someone registers a password account on an
        // address they do not own, then waits for its real owner to arrive through Google.
        using var harness = new TestHarness();
        var squatter = await harness.AddAuthorAsync("victim@example.com", Password, emailConfirmedAt: null);
        harness.Google.Add("token", "google-123", "victim@example.com");

        await Assert.ThrowsAsync<ConflictException>(() =>
            harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" }));

        Assert.Empty(harness.Context.ExternalLogins);
        Assert.Null(harness.Context.Authors.Single(a => a.Id == squatter.Id).EmailConfirmedAt);
    }

    [Fact]
    public async Task Google_sign_in_adopts_an_account_that_has_no_password()
    {
        using var harness = new TestHarness();
        var existing = await harness.AddAuthorAsync("passwordless@example.com", password: null);
        harness.Google.Add("token", "google-123", "passwordless@example.com");

        var result = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        Assert.Equal(existing.Id, result.Author.Id);
        Assert.Single(harness.Context.Authors);
        Assert.NotNull(harness.Context.Authors.Single().EmailConfirmedAt);
    }

    [Fact]
    public async Task Google_sign_in_adopts_a_password_account_whose_address_is_confirmed()
    {
        using var harness = new TestHarness();
        var existing = await harness.AddAuthorAsync(
            "confirmed@example.com", Password, emailConfirmedAt: harness.TimeProvider.GetUtcNow());
        harness.Google.Add("token", "google-123", "confirmed@example.com");

        var result = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        Assert.Equal(existing.Id, result.Author.Id);
        Assert.Single(harness.Context.Authors);
    }

    [Fact]
    public async Task Linking_google_gives_a_password_account_a_second_way_in()
    {
        using var harness = new TestHarness();
        var author = await harness.AddAuthorAsync("jane@example.com", Password);
        harness.SignIn(author);
        harness.Google.Add("token", "google-123", "jane@example.com");

        var profile = await harness.Auth.LinkGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        Assert.True(profile.HasPassword);
        Assert.True(profile.IsEmailConfirmed);
        Assert.Equal(new[] { ExternalLoginProvider.Google }, profile.LinkedProviders);

        // And now the sign-in that was refused before goes straight through.
        harness.SignOut();
        var result = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });
        Assert.Equal(author.Id, result.Author.Id);
    }

    [Fact]
    public async Task Linking_a_google_account_under_a_different_address_does_not_confirm_the_account()
    {
        using var harness = new TestHarness();
        var author = await harness.AddAuthorAsync("jane@example.com", Password);
        harness.SignIn(author);
        harness.Google.Add("token", "google-123", "jane.personal@example.com");

        var profile = await harness.Auth.LinkGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        Assert.False(profile.IsEmailConfirmed);
        Assert.Single(profile.LinkedProviders);
    }

    [Fact]
    public async Task Linking_is_idempotent()
    {
        using var harness = new TestHarness();
        var author = await harness.AddAuthorAsync("jane@example.com", Password);
        harness.SignIn(author);
        harness.Google.Add("token", "google-123", "jane@example.com");

        await harness.Auth.LinkGoogleAsync(new GoogleSignInDto { IdToken = "token" });
        var profile = await harness.Auth.LinkGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        Assert.Single(profile.LinkedProviders);
        Assert.Single(harness.Context.ExternalLogins);
    }

    [Fact]
    public async Task A_google_account_cannot_be_linked_to_two_authors()
    {
        using var harness = new TestHarness();
        var first = await harness.AddAuthorAsync("first@example.com", Password);
        var second = await harness.AddAuthorAsync("second@example.com", Password);
        harness.Google.Add("token", "google-123", "first@example.com");

        harness.SignIn(first);
        await harness.Auth.LinkGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        harness.SignIn(second);
        await Assert.ThrowsAsync<ConflictException>(() =>
            harness.Auth.LinkGoogleAsync(new GoogleSignInDto { IdToken = "token" }));
    }

    [Fact]
    public async Task Linking_requires_a_signed_in_caller()
    {
        using var harness = new TestHarness();
        harness.Google.Add("token", "google-123", "jane@example.com");

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            harness.Auth.LinkGoogleAsync(new GoogleSignInDto { IdToken = "token" }));
    }

    [Fact]
    public async Task The_profile_describes_the_ways_the_account_can_sign_in()
    {
        using var harness = new TestHarness();
        var author = await harness.AddAuthorAsync("google-only@example.com", password: null);
        harness.SignIn(author);

        var profile = await harness.Auth.GetProfileAsync();

        Assert.False(profile.HasPassword);
        Assert.Empty(profile.LinkedProviders);
    }

    [Fact]
    public async Task A_google_account_can_set_its_first_password_without_proving_an_old_one()
    {
        using var harness = new TestHarness();
        var author = await harness.AddAuthorAsync("google-only@example.com", password: null);
        harness.SignIn(author);

        await harness.Auth.SetPasswordAsync(new SetPasswordDto { NewPassword = Password });

        var result = await harness.Auth.LoginAsync(
            new LoginDto { Email = "google-only@example.com", Password = Password });
        Assert.NotEmpty(result.AccessToken);
    }

    [Fact]
    public async Task Changing_a_password_requires_the_current_one()
    {
        using var harness = new TestHarness();
        var author = await harness.AddAuthorAsync("jane@example.com", Password);
        harness.SignIn(author);

        await Assert.ThrowsAsync<UnauthorizedException>(() => harness.Auth.SetPasswordAsync(
            new SetPasswordDto { CurrentPassword = "not the password", NewPassword = "a different password" }));

        await Assert.ThrowsAsync<UnauthorizedException>(() => harness.Auth.SetPasswordAsync(
            new SetPasswordDto { CurrentPassword = null, NewPassword = "a different password" }));
    }

    [Fact]
    public async Task Changing_a_password_ends_other_sessions_but_not_this_one()
    {
        using var harness = new TestHarness();
        var author = await harness.AddAuthorAsync("jane@example.com", Password);
        harness.SignIn(author);

        var otherDevice = await harness.Auth.LoginAsync(new LoginDto { Email = "jane@example.com", Password = Password });

        var changed = await harness.Auth.SetPasswordAsync(new SetPasswordDto
        {
            CurrentPassword = Password,
            NewPassword = "a brand new password"
        });

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => harness.Auth.RefreshAsync(new RefreshTokenDto { RefreshToken = otherDevice.RefreshToken }));

        var stillValid = await harness.Auth.RefreshAsync(new RefreshTokenDto { RefreshToken = changed.RefreshToken });
        Assert.NotEmpty(stillValid.AccessToken);
    }

    [Fact]
    public async Task Signing_out_kills_only_the_token_presented()
    {
        using var harness = new TestHarness();
        var author = await harness.AddAuthorAsync("jane@example.com", Password);

        var phone = await harness.Auth.LoginAsync(new LoginDto { Email = "jane@example.com", Password = Password });
        var laptop = await harness.Auth.LoginAsync(new LoginDto { Email = "jane@example.com", Password = Password });

        await harness.Auth.LogoutAsync(new RefreshTokenDto { RefreshToken = phone.RefreshToken });

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => harness.Auth.RefreshAsync(new RefreshTokenDto { RefreshToken = phone.RefreshToken }));
        Assert.NotEmpty((await harness.Auth.RefreshAsync(
            new RefreshTokenDto { RefreshToken = laptop.RefreshToken })).AccessToken);
    }

    [Fact]
    public async Task Deleting_an_author_takes_their_logins_and_tokens_with_it()
    {
        using var harness = new TestHarness();
        harness.Google.Add("token", "google-123", "jane@example.com");
        var result = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        var author = await harness.Context.Authors.SingleAsync();
        harness.SignIn(author);
        await harness.AuthorService.DeleteAsync(author.Id);

        Assert.Empty(harness.Context.Authors);
        Assert.Empty(harness.Context.ExternalLogins);
        Assert.Empty(harness.Context.RefreshTokens);
        await Assert.ThrowsAsync<UnauthorizedException>(
            () => harness.Auth.RefreshAsync(new RefreshTokenDto { RefreshToken = result.RefreshToken }));
    }
}
