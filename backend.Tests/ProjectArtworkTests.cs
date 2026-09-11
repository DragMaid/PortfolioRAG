using Backend.Common.Exceptions;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

/// <summary>
/// The rule that a project leads with a thumbnail and a trailer, and what that means at
/// each point it could be broken: publishing without them, deleting one afterwards, and
/// putting the wrong kind of file in either slot.
/// </summary>
public class ProjectArtworkTests
{
    [Fact]
    public async Task A_project_cannot_be_published_without_a_thumbnail_and_a_trailer()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var draft = await harness.AddPostAsync(author, isDraft: true);

        var refused = await Assert.ThrowsAsync<ValidationException>(
            () => harness.PostService.PublishAsync(draft.Id));

        // Both are named at once: fixing one and being told about the other on the next
        // attempt is two trips for an answer the server had all along.
        Assert.Contains("thumbnail", refused.Message);
        Assert.Contains("trailer", refused.Message);
    }

    [Fact]
    public async Task A_project_with_only_a_thumbnail_still_cannot_be_published()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var draft = await harness.AddPostAsync(author, isDraft: true);
        await harness.MediaService.AddToPostAsync(draft.Id, TestFiles.FormFile(TestFiles.Png(), "shot.png", "image/png"), MediaRole.Thumbnail);

        var refused = await Assert.ThrowsAsync<ValidationException>(
            () => harness.PostService.PublishAsync(draft.Id));

        Assert.DoesNotContain("thumbnail", refused.Message);
        Assert.Contains("trailer", refused.Message);
    }

    [Fact]
    public async Task A_project_with_both_publishes()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var draft = await harness.AddPostAsync(author, isDraft: true);
        await harness.MediaService.AddToPostAsync(draft.Id, TestFiles.FormFile(TestFiles.Png(), "shot.png", "image/png"), MediaRole.Thumbnail);
        await harness.MediaService.AddToPostAsync(draft.Id, TestFiles.FormFile(TestFiles.Mp4(), "clip.mp4", "video/mp4"), MediaRole.Trailer);

        var published = await harness.PostService.PublishAsync(draft.Id);

        Assert.False(published.IsDraft);
        Assert.NotNull(published.Thumbnail);
        Assert.NotNull(published.Trailer);
        Assert.Equal(MediaRole.Thumbnail, published.Thumbnail!.Role);
        Assert.Equal(MediaRole.Trailer, published.Trailer!.Role);
    }

    [Fact]
    public async Task A_thumbnail_cannot_be_a_video_but_a_trailer_can()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var post = await harness.AddPostAsync(author, isDraft: true);

        // A card draws its thumbnail as a still and nothing ever plays it, so a video there
        // would render as a dead frame.
        await Assert.ThrowsAsync<UnsupportedMediaTypeException>(
            () => harness.MediaService.AddToPostAsync(
                post.Id, TestFiles.FormFile(TestFiles.Mp4(), "clip.mp4", "video/mp4"), MediaRole.Thumbnail));

        var trailer = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Mp4(), "clip.mp4", "video/mp4"), MediaRole.Trailer);

        Assert.Equal(MediaExtension.Mp4, trailer.Extension);
    }

    [Fact]
    public async Task A_trailer_may_also_be_a_picture()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var post = await harness.AddPostAsync(author, isDraft: true);

        var trailer = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "shot.png", "image/png"), MediaRole.Trailer);

        Assert.Equal(MediaRole.Trailer, trailer.Role);
        Assert.Equal(MediaExtension.Webp, trailer.Extension);
    }

    [Fact]
    public async Task Uploading_a_second_thumbnail_replaces_the_first_and_clears_its_object()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var post = await harness.AddPostAsync(author, isDraft: true);

        var first = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "shot.png", "image/png"), MediaRole.Thumbnail);
        var second = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Jpeg(), "shot.jpg", "image/jpeg"), MediaRole.Thumbnail);

        Assert.NotEqual(first.Id, second.Id);

        // One row in the slot, and the bucket no longer holds what it replaced.
        var thumbnails = await harness.Context.Medias
            .Where(m => m.PostId == post.Id && m.Role == MediaRole.Thumbnail)
            .ToListAsync();

        Assert.Single(thumbnails);
        Assert.Equal(second.Id, thumbnails[0].Id);

        Assert.False(await harness.Context.Medias.AnyAsync(m => m.Id == first.Id));

        // The bucket lets go of the replaced file too, rather than keeping a copy nothing
        // will ever name again.
        Assert.Single(harness.Storage.KeysUnder($"authors/{author.Id}/posts/{post.Id}/"));
    }

    [Fact]
    public async Task Attachments_are_not_limited_to_one_per_post()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var post = await harness.AddPostAsync(author, isDraft: true);

        await harness.MediaService.AddToPostAsync(post.Id, TestFiles.FormFile(TestFiles.Png(), "shot.png", "image/png"));
        await harness.MediaService.AddToPostAsync(post.Id, TestFiles.FormFile(TestFiles.Jpeg(), "shot.jpg", "image/jpeg"));
        await harness.MediaService.AddToPostAsync(post.Id, TestFiles.FormFile(TestFiles.Gif(), "shot.gif", "image/gif"));

        var attachments = await harness.Context.Medias
            .Where(m => m.PostId == post.Id && m.Role == MediaRole.Attachment)
            .CountAsync();

        Assert.Equal(3, attachments);
    }

    [Fact]
    public async Task A_published_project_cannot_have_its_thumbnail_deleted()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var draft = await harness.AddPostAsync(author, isDraft: true);
        var thumbnail = await harness.MediaService.AddToPostAsync(
            draft.Id, TestFiles.FormFile(TestFiles.Png(), "shot.png", "image/png"), MediaRole.Thumbnail);
        await harness.MediaService.AddToPostAsync(
            draft.Id, TestFiles.FormFile(TestFiles.Png(), "shot.png", "image/png"), MediaRole.Trailer);

        await harness.PostService.PublishAsync(draft.Id);

        // The other side of the publish gate: a live project must not be left with a hole
        // in it that nothing would flag.
        await Assert.ThrowsAsync<ValidationException>(
            () => harness.MediaService.DeleteAsync(draft.Id, thumbnail.Id));

        await harness.PostService.UnpublishAsync(draft.Id);
        await harness.MediaService.DeleteAsync(draft.Id, thumbnail.Id);

        Assert.False(await harness.Context.Medias.AnyAsync(m => m.Id == thumbnail.Id));
    }

    [Fact]
    public async Task An_ordinary_attachment_can_be_deleted_from_a_published_project()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var draft = await harness.AddPostAsync(author, isDraft: true, withArtwork: true);
        var attachment = await harness.MediaService.AddToPostAsync(
            draft.Id, TestFiles.FormFile(TestFiles.Png(), "shot.png", "image/png"));

        await harness.PostService.PublishAsync(draft.Id);
        await harness.MediaService.DeleteAsync(draft.Id, attachment.Id);

        Assert.False(await harness.Context.Medias.AnyAsync(m => m.Id == attachment.Id));
    }

    [Fact]
    public async Task The_project_fields_survive_a_create_and_an_update()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var created = await harness.PostService.CreateAsync(new CreatePostDto
        {
            Title = "Aether Engine",
            Body = "body",
            Category = "VECTOR CORE",
            Domain = "Vector Storage",
            RepoUrl = "https://github.com/demo/aether"
        });

        Assert.Equal("VECTOR CORE", created.Category);
        Assert.Equal("Vector Storage", created.Domain);
        Assert.Equal("https://github.com/demo/aether", created.RepoUrl);
        Assert.Null(created.DemoUrl);

        var updated = await harness.PostService.UpdateAsync(created.Id, new UpdatePostDto
        {
            Title = "Aether Engine",
            Body = "body",
            Category = "  ",
            Domain = "Vector Search",
            DemoUrl = "https://demo.invalid/aether"
        });

        // Blank is cleared rather than stored as whitespace, so the card renders nothing
        // instead of an empty label.
        Assert.Null(updated.Category);
        Assert.Equal("Vector Search", updated.Domain);
        Assert.Equal("https://demo.invalid/aether", updated.DemoUrl);
        Assert.Null(updated.RepoUrl);
    }
}
