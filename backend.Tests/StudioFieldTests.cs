using Backend.Common.Exceptions;
using Backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

/// <summary>
/// The fields the admin studio added to a post and to an uploaded file: the showcase flag,
/// the technology taxonomy, and what a file is for.
/// </summary>
public class StudioFieldTests
{
    [Fact]
    public async Task A_new_post_is_not_a_showcase_until_it_is_made_one()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var post = await harness.PostService.CreateAsync(new CreatePostDto
        {
            Title = "A project",
            Body = "body",
        });

        Assert.False(post.IsFeatured);

        var updated = await harness.PostService.UpdateAsync(post.Id, new UpdatePostDto
        {
            Title = "A project",
            Body = "body",
            IsFeatured = true,
        });

        Assert.True(updated.IsFeatured);
    }

    [Fact]
    public async Task The_public_feed_can_be_narrowed_to_showcase_posts()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var hero = await harness.AddPostAsync(author, isDraft: false, title: "Hero", isFeatured: true);
        await harness.AddPostAsync(author, isDraft: false, title: "Ordinary");

        var featured = await harness.PostService.GetPublicAsync(
            new Backend.Models.Requests.PostQueryRequest { IsFeatured = true });

        Assert.Equal(hero.Id, Assert.Single(featured.Items).Id);
    }

    [Fact]
    public async Task A_caption_can_be_written_and_cleared_on_your_own_file()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(60, 60), "diagram.png", "image/png"));

        Assert.Null(media.Caption);

        var captioned = await harness.MediaService.UpdateAsync(
            post.Id, media.Id, new UpdateMediaDto { Caption = "  Hero architecture figure  " });

        Assert.Equal("Hero architecture figure", captioned.Caption);

        // Blank means "no caption" rather than an empty one, so the UI can fall back to the
        // filename instead of rendering nothing.
        var cleared = await harness.MediaService.UpdateAsync(
            post.Id, media.Id, new UpdateMediaDto { Caption = "   " });

        Assert.Null(cleared.Caption);
    }

    [Fact]
    public async Task A_caption_cannot_be_written_on_someone_else_s_file()
    {
        await using var harness = await TestHarness.CreateAsync();
        var owner = await harness.AddAuthorAsync("owner@example.com");
        var stranger = await harness.AddAuthorAsync("stranger@example.com");
        var post = await harness.AddPostAsync(owner);

        harness.SignIn(owner);
        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(60, 60), "diagram.png", "image/png"));

        harness.SignIn(stranger);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => harness.MediaService.UpdateAsync(
                post.Id, media.Id, new UpdateMediaDto { Caption = "mine now" }));
    }

    [Fact]
    public async Task A_file_reached_through_the_wrong_post_s_address_is_not_there()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author);
        var other = await harness.AddPostAsync(author, title: "Another");
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(60, 60), "diagram.png", "image/png"));

        // Letting one post's URL act on another's file would be a route that lies about
        // what it addresses, so it is a 404 rather than a 403.
        await Assert.ThrowsAsync<NotFoundException>(
            () => harness.MediaService.UpdateAsync(
                other.Id, media.Id, new UpdateMediaDto { Caption = "wrong post" }));
    }

    [Fact]
    public async Task A_caption_survives_a_reread_from_the_database()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(60, 60), "diagram.png", "image/png"));

        await harness.MediaService.UpdateAsync(
            post.Id, media.Id, new UpdateMediaDto { Caption = "SIMD benchmark graph" });

        var listed = Assert.Single(await harness.MediaService.GetForPostAsync(post.Id));
        Assert.Equal("SIMD benchmark graph", listed.Caption);

        Assert.Equal(
            "SIMD benchmark graph",
            (await harness.Context.Medias.AsNoTracking().SingleAsync()).Caption);
    }
}
