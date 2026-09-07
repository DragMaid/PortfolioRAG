using Backend.Common.Exceptions;
using Backend.Models.DTOs.Auth;

namespace Backend.Tests;

public class TokenServiceTests
{
    [Fact]
    public async Task Issue_returns_an_access_token_and_a_refresh_token()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a password here");

        var result = await harness.Tokens.IssueAsync(author);

        Assert.NotEmpty(result.AccessToken);
        Assert.NotEmpty(result.RefreshToken);
        Assert.Equal("Bearer", result.TokenType);
        Assert.Equal(15 * 60, result.ExpiresIn);
        Assert.Equal(author.Id, result.Author.Id);
    }

    [Fact]
    public async Task The_raw_refresh_token_is_never_stored()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a password here");

        var result = await harness.Tokens.IssueAsync(author);
        var stored = harness.Context.RefreshTokens.Single();

        Assert.NotEqual(result.RefreshToken, stored.TokenHash);
        Assert.DoesNotContain(result.RefreshToken, stored.TokenHash);
    }

    [Fact]
    public async Task Rotate_spends_the_old_token_and_issues_a_new_one()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a password here");
        var first = await harness.Tokens.IssueAsync(author);

        var second = await harness.Tokens.RotateAsync(first.RefreshToken);

        Assert.NotEqual(first.RefreshToken, second.RefreshToken);

        var spent = harness.Context.RefreshTokens.Single(t => t.ReplacedByTokenHash != null);
        Assert.NotNull(spent.RevokedAt);
    }

    [Fact]
    public async Task Replaying_a_spent_token_revokes_every_token_the_author_holds()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a password here");
        var first = await harness.Tokens.IssueAsync(author);
        var second = await harness.Tokens.RotateAsync(first.RefreshToken);

        await Assert.ThrowsAsync<UnauthorizedException>(() => harness.Tokens.RotateAsync(first.RefreshToken));

        // The replacement is collateral: the family is assumed compromised.
        await Assert.ThrowsAsync<UnauthorizedException>(() => harness.Tokens.RotateAsync(second.RefreshToken));
        Assert.All(harness.Context.RefreshTokens, token => Assert.NotNull(token.RevokedAt));
    }

    [Fact]
    public async Task A_revoked_token_that_was_never_rotated_does_not_cascade()
    {
        // Signing out on one device, or changing the password, must not let that device's
        // dead token take down the session that replaced it.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a password here");
        var abandoned = await harness.Tokens.IssueAsync(author);
        await harness.Tokens.RevokeAsync(abandoned.RefreshToken);

        var live = await harness.Tokens.IssueAsync(author);

        await Assert.ThrowsAsync<UnauthorizedException>(() => harness.Tokens.RotateAsync(abandoned.RefreshToken));

        var stillWorks = await harness.Tokens.RotateAsync(live.RefreshToken);
        Assert.NotEmpty(stillWorks.AccessToken);
    }

    [Fact]
    public async Task An_expired_token_cannot_be_rotated()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a password here");
        var issued = await harness.Tokens.IssueAsync(author);

        harness.TimeProvider.Advance(TimeSpan.FromDays(15));

        await Assert.ThrowsAsync<UnauthorizedException>(() => harness.Tokens.RotateAsync(issued.RefreshToken));
    }

    [Fact]
    public async Task An_unknown_token_is_rejected()
    {
        await using var harness = await TestHarness.CreateAsync();
        await Assert.ThrowsAsync<UnauthorizedException>(() => harness.Tokens.RotateAsync("never-issued"));
    }

    [Fact]
    public async Task Revoking_an_unknown_token_is_not_an_error()
    {
        await using var harness = await TestHarness.CreateAsync();
        await harness.Tokens.RevokeAsync("never-issued");
    }

    [Fact]
    public async Task RevokeAll_ends_every_active_session()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a password here");

        var sessions = new List<AuthResultDto>
        {
            await harness.Tokens.IssueAsync(author),
            await harness.Tokens.IssueAsync(author),
            await harness.Tokens.IssueAsync(author)
        };

        await harness.Tokens.RevokeAllAsync(author.Id);

        foreach (var session in sessions)
        {
            await Assert.ThrowsAsync<UnauthorizedException>(() => harness.Tokens.RotateAsync(session.RefreshToken));
        }
    }

    [Fact]
    public async Task One_authors_tokens_are_untouched_when_another_signs_out_everywhere()
    {
        await using var harness = await TestHarness.CreateAsync();
        var first = await harness.AddAuthorAsync("first@example.com", "a password here");
        var second = await harness.AddAuthorAsync("second@example.com", "a password here");

        var untouched = await harness.Tokens.IssueAsync(second);
        await harness.Tokens.IssueAsync(first);
        await harness.Tokens.RevokeAllAsync(first.Id);

        Assert.NotEmpty((await harness.Tokens.RotateAsync(untouched.RefreshToken)).AccessToken);
    }
}
