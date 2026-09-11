using Backend.Common.Exceptions;
using Backend.Models.DTOs;
using Backend.Models.DTOs.Auth;

namespace Backend.Tests;

/// <summary>
/// The public handle every account gets. Signing up is how somebody gets a portfolio of
/// their own, and a portfolio nothing can link to is not one — so the address is settled at
/// registration rather than left to be filled in later.
/// </summary>
public class HandleTests
{
    [Fact]
    public async Task Registering_derives_a_handle_from_the_name()
    {
        await using var harness = await TestHarness.CreateAsync();

        var result = await harness.Auth.RegisterAsync(new RegisterDto
        {
            Name = "Ada Lovelace",
            Email = "ada@example.com",
            Password = "a long enough password"
        });

        Assert.Equal("ada-lovelace", result.Author.Handle);
    }

    [Fact]
    public async Task A_second_account_with_the_same_name_gets_a_distinct_handle()
    {
        await using var harness = await TestHarness.CreateAsync();

        var first = await harness.Auth.RegisterAsync(new RegisterDto
        {
            Name = "Ada Lovelace",
            Email = "ada@example.com",
            Password = "a long enough password"
        });

        var second = await harness.Auth.RegisterAsync(new RegisterDto
        {
            Name = "Ada Lovelace",
            Email = "ada2@example.com",
            Password = "a long enough password"
        });

        Assert.Equal("ada-lovelace", first.Author.Handle);
        Assert.NotEqual(first.Author.Handle, second.Author.Handle);
        Assert.StartsWith("ada-lovelace", second.Author.Handle);
    }

    [Fact]
    public async Task A_name_that_slugs_to_nothing_falls_back_to_the_address()
    {
        await using var harness = await TestHarness.CreateAsync();

        // A name written entirely outside the Latin range slugs to "", which is not an
        // address. The local part of the email is the next best thing the account owns.
        var result = await harness.Auth.RegisterAsync(new RegisterDto
        {
            Name = "日本語",
            Email = "kenji@example.com",
            Password = "a long enough password"
        });

        Assert.Equal("kenji", result.Author.Handle);
    }

    [Fact]
    public async Task A_portfolio_is_reachable_by_its_handle()
    {
        await using var harness = await TestHarness.CreateAsync();

        var registered = await harness.Auth.RegisterAsync(new RegisterDto
        {
            Name = "Ada Lovelace",
            Email = "ada@example.com",
            Password = "a long enough password"
        });

        var found = await harness.AuthorService.GetByHandleAsync("ada-lovelace");

        Assert.Equal(registered.Author.Id, found.Id);

        await Assert.ThrowsAsync<NotFoundException>(
            () => harness.AuthorService.GetByHandleAsync("nobody"));
    }

    [Fact]
    public async Task A_handle_already_in_use_is_refused_rather_than_quietly_suffixed()
    {
        await using var harness = await TestHarness.CreateAsync();

        await harness.Auth.RegisterAsync(new RegisterDto
        {
            Name = "Ada Lovelace",
            Email = "ada@example.com",
            Password = "a long enough password"
        });

        var second = await harness.Auth.RegisterAsync(new RegisterDto
        {
            Name = "Grace Hopper",
            Email = "grace@example.com",
            Password = "a long enough password"
        });

        harness.SignIn(second.Author.Id, second.Author.Email);

        // A handle the author typed is an address they mean to publish. Handing back
        // "ada-lovelace-2" is how somebody ends up printing the wrong link on a CV.
        await Assert.ThrowsAsync<ConflictException>(() =>
            harness.AuthorService.UpdateAsync(second.Author.Id, new UpdateAuthorDto
            {
                Name = "Grace Hopper",
                Email = "grace@example.com",
                Handle = "ada-lovelace"
            }));
    }

    [Fact]
    public async Task An_author_can_move_their_own_portfolio_to_a_free_handle()
    {
        await using var harness = await TestHarness.CreateAsync();

        var registered = await harness.Auth.RegisterAsync(new RegisterDto
        {
            Name = "Ada Lovelace",
            Email = "ada@example.com",
            Password = "a long enough password"
        });

        harness.SignIn(registered.Author.Id, registered.Author.Email);

        var updated = await harness.AuthorService.UpdateAsync(registered.Author.Id, new UpdateAuthorDto
        {
            Name = "Ada Lovelace",
            Email = "ada@example.com",
            Handle = "ada"
        });

        Assert.Equal("ada", updated.Handle);

        // Keeping your own handle across an edit must not read as a collision with yourself.
        var again = await harness.AuthorService.UpdateAsync(registered.Author.Id, new UpdateAuthorDto
        {
            Name = "Ada L",
            Email = "ada@example.com",
            Handle = "ada"
        });

        Assert.Equal("ada", again.Handle);
    }

    [Fact]
    public async Task An_account_created_through_google_also_gets_a_handle()
    {
        await using var harness = await TestHarness.CreateAsync();
        harness.Google.Add("token", subject: "google-1", email: "ada@example.com", name: "Ada Lovelace");

        var result = await harness.Auth.SignInWithGoogleAsync(new GoogleSignInDto { IdToken = "token" });

        Assert.Equal("ada-lovelace", result.Author.Handle);
    }
}
