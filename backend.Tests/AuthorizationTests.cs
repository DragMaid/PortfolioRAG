using Backend.Common.Exceptions;
using Backend.Models.DTOs;
using Backend.Models.DTOs.Auth;
using Backend.Models.Requests;

namespace Backend.Tests;

/// <summary>
/// The rule this project settled on: an author acts only on their own posts and their own
/// account. There is no role that lets anyone write or publish on someone else's behalf.
/// </summary>
public class AuthorizationTests
{
    [Fact]
    public async Task Drafts_are_only_listed_for_their_own_author()
    {
        // Arrage
        await using var harness = await TestHarness.CreateAsync();
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var theirs = await harness.AddAuthorAsync("theirs@example.com", "a long enough password");

        // Act
        await harness.AddPostAsync(mine, isDraft: true, title: "My draft");
        await harness.AddPostAsync(mine, isDraft: false, title: "My published post");
        await harness.AddPostAsync(theirs, isDraft: true, title: "Their draft");

        harness.SignIn(mine);
        var page = await harness.PostService.GetByDraftAsync(new PostQueryRequest());

        // Assert
        Assert.Equal(2, page.TotalItems);
        Assert.All(page.Items, item => Assert.Equal(mine.Id, item.Author.Id));
    }

    [Fact]
    public async Task An_author_id_in_the_query_string_cannot_widen_the_listing()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var theirs = await harness.AddAuthorAsync("theirs@example.com", "a long enough password");

        // Act
        await harness.AddPostAsync(mine, isDraft: true);
        await harness.AddPostAsync(theirs, isDraft: true);

        harness.SignIn(mine);
        var page = await harness.PostService.GetByDraftAsync(new PostQueryRequest { AuthorId = theirs.Id });

        // Assert
        Assert.Single(page.Items);
        Assert.Equal(mine.Id, page.Items[0].Author.Id);
    }

    [Fact]
    public async Task The_authoring_list_needs_a_signed_in_caller()
    {
        await using var harness = await TestHarness.CreateAsync();

        // NOTE: this one sounds weird because the get by draft is available only to authors
        // while the GetPublicPosts can be called by annoynomous users
        await Assert.ThrowsAsync<UnauthorizedException>(
            () => harness.PostService.GetByDraftAsync(new PostQueryRequest()));
    }

    [Fact]
    public async Task Another_authors_post_cannot_be_read_edited_published_or_deleted()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();

        // ACtion
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var theirs = await harness.AddAuthorAsync("theirs@example.com", "a long enough password");
        var theirPost = await harness.AddPostAsync(theirs, isDraft: true);
        harness.SignIn(mine);

        // Assert
        await Assert.ThrowsAsync<ForbiddenException>(() => harness.PostService.GetByIdAsync(theirPost.Id));
        await Assert.ThrowsAsync<ForbiddenException>(() => harness.PostService.PublishAsync(theirPost.Id));
        await Assert.ThrowsAsync<ForbiddenException>(() => harness.PostService.UnpublishAsync(theirPost.Id));
        await Assert.ThrowsAsync<ForbiddenException>(() => harness.PostService.DeleteAsync(theirPost.Id));
        await Assert.ThrowsAsync<ForbiddenException>(() => harness.PostService.UpdateAsync(
            theirPost.Id, new UpdatePostDto { Title = "Rewritten", Body = "by someone else" }));

        // Making sure that the forbbiden is sent before any modification happened
        var untouched = harness.Context.Posts.Single(p => p.Id == theirPost.Id);
        Assert.True(untouched.IsDraft);
        Assert.NotEqual("Rewritten", untouched.Title);
    }

    [Fact]
    public async Task An_author_can_publish_their_own_draft()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();

        // Act
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var draft = await harness.AddPostAsync(mine, isDraft: true, withArtwork: true);
        harness.SignIn(mine);
        var published = await harness.PostService.PublishAsync(draft.Id);

        // Assert
        Assert.False(published.IsDraft);
        Assert.NotNull(published.PublishedAt);
    }

    [Fact]
    public async Task Republishing_keeps_the_original_publication_date()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();
        

        // Act
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var draft = await harness.AddPostAsync(mine, isDraft: true, withArtwork: true);
        harness.SignIn(mine);
        var firstPublish = await harness.PostService.PublishAsync(draft.Id);
        harness.TimeProvider.Advance(TimeSpan.FromDays(3));
        await harness.PostService.UnpublishAsync(draft.Id);
        var second = await harness.PostService.PublishAsync(draft.Id);

        // Assert
        Assert.Equal(firstPublish.PublishedAt, second.PublishedAt);
    }

    [Fact]
    public async Task A_new_post_is_filed_under_the_caller_and_starts_as_a_draft()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();

        // Act
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        await harness.AddAuthorAsync("theirs@example.com", "a long enough password");

        harness.SignIn(mine);
        var created = await harness.PostService.CreateAsync(new CreatePostDto
        {
            Title = "Something I wrote",
            Body = "The body."
        });

        // Assert
        Assert.Equal(mine.Id, created.Author.Id);
        Assert.True(created.IsDraft);
        Assert.Null(created.PublishedAt);
        Assert.Equal("something-i-wrote", created.Slug);
    }

    [Fact]
    public async Task Creating_a_post_needs_a_signed_in_caller()
    {
        await using var harness = await TestHarness.CreateAsync();

        await Assert.ThrowsAsync<UnauthorizedException>(() => harness.PostService.CreateAsync(
            new CreatePostDto { Title = "Anonymous post", Body = "The body." }));
    }

    [Fact]
    public async Task A_post_without_a_summary_can_be_created()
    {
        await using var harness = await TestHarness.CreateAsync();
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        harness.SignIn(mine);

        var created = await harness.PostService.CreateAsync(new CreatePostDto
        {
            Title = "No summary here",
            Body = "The body."
        });

        Assert.Null(created.Summary);
    }

    [Fact]
    public async Task The_public_feed_shows_published_posts_only()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        await harness.AddPostAsync(author, isDraft: true);
        var published = await harness.AddPostAsync(author, isDraft: false);

        // No caller at all: the public feed never asks who is reading.
        var page = await harness.PostService.GetPublicAsync(new PostQueryRequest());

        Assert.Single(page.Items);
        Assert.Equal(published.Id, page.Items[0].Id);
    }

    [Fact]
    public async Task A_draft_is_not_reachable_by_slug_even_by_its_own_author()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();

        // Act
        var author = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var draft = await harness.AddPostAsync(author, isDraft: true);

        harness.SignIn(author);

        // Assert
        await Assert.ThrowsAsync<NotFoundException>(() => harness.PostService.GetPublicBySlugAsync(draft.Slug));
        await Assert.ThrowsAsync<NotFoundException>(() => harness.PostService.RegisterViewAsync(draft.Slug));
    }

    [Fact]
    public async Task A_missing_post_is_a_404_not_a_403()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();

        // Act
        var author = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        harness.SignIn(author);

        // Assert
        await Assert.ThrowsAsync<NotFoundException>(() => harness.PostService.GetByIdAsync(4242));
    }

    [Fact]
    public async Task An_author_can_only_edit_and_delete_their_own_account()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();

        // Act
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var theirs = await harness.AddAuthorAsync("theirs@example.com", "a long enough password");
        harness.SignIn(mine);

        // Assert
        await Assert.ThrowsAsync<ForbiddenException>(() => harness.AuthorService.UpdateAsync(
            theirs.Id, new UpdateAuthorDto { Name = "Hijacked", Email = "theirs@example.com" }));
        await Assert.ThrowsAsync<ForbiddenException>(() => harness.AuthorService.DeleteAsync(theirs.Id));

        Assert.Equal("theirs", harness.Context.Authors.Single(a => a.Id == theirs.Id).Name);
    }

    [Fact]
    public async Task Editing_your_own_profile_is_persisted()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();

        // Act
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        harness.SignIn(mine);

        var updated = await harness.AuthorService.UpdateAsync(mine.Id, new UpdateAuthorDto
        {
            Name = "New Name",
            Email = "mine@example.com",
            Biography = "A bio."
        });

        // Assert
        Assert.Equal("New Name", updated.Name);
        Assert.Equal("A bio.", updated.Biography);

        var stored = harness.Context.Authors.Single(a => a.Id == mine.Id);
        Assert.Equal("New Name", stored.Name);
    }

    [Fact]
    public async Task Moving_to_a_new_address_drops_its_confirmation()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();
        
        // Act
        var mine = await harness.AddAuthorAsync(
            "mine@example.com",
            "a long enough password",
            emailConfirmedAt: harness.TimeProvider.GetUtcNow());
        harness.SignIn(mine);

        await harness.AuthorService.UpdateAsync(mine.Id, new UpdateAuthorDto
        {
            Name = "Mine",
            Email = "moved@example.com"
        });

        // Assert
        Assert.Null(harness.Context.Authors.Single(a => a.Id == mine.Id).EmailConfirmedAt);
    }

    [Fact]
    public async Task Deleting_an_account_takes_its_posts_with_it()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var theirs = await harness.AddAuthorAsync("theirs@example.com", "a long enough password");

        // Act
        await harness.AddPostAsync(mine, title: "Mine");
        var survivor = await harness.AddPostAsync(theirs, title: "Theirs");

        harness.SignIn(mine);
        await harness.AuthorService.DeleteAsync(mine.Id);

        // Assert: closing an account leaves nothing of it behind, and touches nobody else's.
        Assert.Empty(harness.Context.Posts.Where(p => p.AuthorId == mine.Id));
        Assert.Equal(survivor.Id, harness.Context.Posts.Single().Id);
    }

    [Fact]
    public async Task Author_profiles_are_readable_without_signing_in()
    {
        // Arrange
        await using var harness = await TestHarness.CreateAsync();

        // Act
        var author = await harness.AddAuthorAsync("mine@example.com", "a long enough password");

        // Assert
        Assert.Single(await harness.AuthorService.GetAllAsync());
        Assert.Equal(author.Id, (await harness.AuthorService.GetByIdAsync(author.Id)).Id);
    }
}
