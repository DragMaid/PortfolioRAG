using Backend.Common.Exceptions;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

/// <summary>
/// Attaching files to posts. The rules are the same ones the rest of the API lives by — an
/// author acts only on their own posts, and a draft is invisible until it is published —
/// with the bucket as a second place that has to be kept in step with the database.
/// </summary>
public class MediaServiceTests
{
    [Fact]
    public async Task Uploading_a_picture_attaches_it_to_the_post()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(900, 300), "photo.png", "image/png"));

        Assert.Equal(post.Id, media.PostId);
        Assert.Equal($"/api/media/{media.Id}/content", media.Url);

        var stored = harness.Context.Medias.Single();
        Assert.Equal(post.Id, stored.PostId);
        Assert.Single(harness.Storage.Objects);
        Assert.True(harness.Storage.Objects.ContainsKey(stored.ObjectKey));
    }

    [Fact]
    public async Task The_stored_object_is_the_optimized_webp_not_what_was_uploaded()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Jpeg(3000, 2000), "photo.jpg", "image/jpeg"));

        Assert.Equal(MediaExtension.Webp, media.Extension);

        var stored = harness.Context.Medias.Single();
        var bytes = harness.Storage.BytesAt(stored.ObjectKey);

        // RIFF....WEBP — what is in the bucket really is a WebP, not a renamed JPEG.
        Assert.Equal("RIFF"u8.ToArray(), bytes[..4]);
        Assert.Equal("WEBP"u8.ToArray(), bytes[8..12]);
    }

    [Fact]
    public async Task The_recorded_byte_size_is_what_the_bucket_holds()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        var upload = TestFiles.Jpeg(3000, 2000);
        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(upload, "photo.jpg", "image/jpeg"));

        var stored = harness.Context.Medias.Single();
        Assert.Equal(harness.Storage.BytesAt(stored.ObjectKey).Length, media.ByteSize);
        // The row describes the stored file, not the one that was sent.
        Assert.NotEqual(upload.Length, media.ByteSize);
    }

    [Fact]
    public async Task The_object_key_never_contains_the_uploaded_filename_verbatim()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "../../etc/Passwd Photo.png", "image/png"));

        var stored = harness.Context.Medias.Single();

        Assert.DoesNotContain("..", stored.ObjectKey);
        Assert.DoesNotContain("Passwd Photo", stored.ObjectKey);
        // A slug of the original survives as a hint for anyone reading the bucket.
        Assert.Contains("passwd-photo", stored.ObjectKey);
    }

    [Fact]
    public async Task The_object_key_is_scoped_to_the_author_and_the_post()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        var stored = harness.Context.Medias.Single();

        // The layout is what makes deleting a post or an account one sweep of one prefix.
        Assert.StartsWith($"authors/{author.Id}/posts/{post.Id}/", stored.ObjectKey);
    }

    [Fact]
    public async Task Two_uploads_of_the_same_filename_get_different_keys()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(64, 64, noisy: true), "photo.png", "image/png"));
        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(48, 48, noisy: true), "photo.png", "image/png"));

        // Otherwise the second upload would silently replace the first in the bucket.
        Assert.Equal(2, harness.Storage.Objects.Count);
        Assert.Equal(2, harness.Context.Medias.Count());
    }

    [Fact]
    public async Task A_video_is_stored_exactly_as_it_arrived()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        var upload = TestFiles.Mp4();
        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(upload, "clip.mp4", "video/mp4"));

        Assert.Equal(MediaExtension.Mp4, media.Extension);

        var stored = harness.Context.Medias.Single();
        Assert.Equal(upload, harness.Storage.BytesAt(stored.ObjectKey));
    }

    [Fact]
    public async Task The_displayed_filename_is_re_extended_to_what_was_stored()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Jpeg(3000, 2000), "holiday.jpg", "image/jpeg"));

        // It went in a JPEG and came out a WebP; the name a reader sees should say so.
        Assert.Equal("holiday.webp", media.Filename);
    }

    [Fact]
    public async Task An_empty_upload_is_refused()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await Assert.ThrowsAsync<ValidationException>(() => harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile([], "empty.png", "image/png")));

        Assert.Empty(harness.Storage.Objects);
    }

    [Fact]
    public async Task A_file_that_is_not_media_is_refused()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        // Named and declared as a picture; only the bytes are consulted.
        await Assert.ThrowsAsync<UnsupportedMediaTypeException>(() => harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.NotMedia(), "photo.png", "image/png")));

        Assert.Empty(harness.Storage.Objects);
        Assert.Empty(harness.Context.Medias);
    }

    [Fact]
    public async Task An_svg_upload_is_refused()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await Assert.ThrowsAsync<UnsupportedMediaTypeException>(() => harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Svg(), "drawing.svg", "image/svg+xml")));
    }

    [Fact]
    public async Task A_picture_over_the_picture_limit_is_refused()
    {
        await using var harness = await TestHarness.CreateAsync(options => options.MaxImageBytes = 512);
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await Assert.ThrowsAsync<PayloadTooLargeException>(() => harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(200, 200, noisy: true), "photo.png", "image/png")));

        Assert.Empty(harness.Storage.Objects);
    }

    [Fact]
    public async Task Uploading_to_someone_elses_post_is_refused()
    {
        await using var harness = await TestHarness.CreateAsync();
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var theirs = await harness.AddAuthorAsync("theirs@example.com", "a long enough password");
        var theirPost = await harness.AddPostAsync(theirs);
        harness.SignIn(mine);

        await Assert.ThrowsAsync<ForbiddenException>(() => harness.MediaService.AddToPostAsync(
            theirPost.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png")));

        Assert.Empty(harness.Storage.Objects);
    }

    [Fact]
    public async Task Uploading_to_a_post_that_does_not_exist_is_a_404()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        await Assert.ThrowsAsync<NotFoundException>(() => harness.MediaService.AddToPostAsync(
            9999, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png")));
    }

    [Fact]
    public async Task Uploading_needs_a_signed_in_caller()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignOut();

        await Assert.ThrowsAsync<UnauthorizedException>(() => harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png")));
    }

    [Fact]
    public async Task A_failed_save_removes_the_object_it_had_just_stored()
    {
        // The object reaches the bucket before the row that names it exists. If the row
        // never arrives, nothing will ever name that key again — an invisible object on a
        // bill that only grows.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        harness.Medias.FailNextSave = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() => harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(900, 300), "photo.png", "image/png")));

        Assert.Empty(harness.Storage.Objects);
        Assert.Single(harness.Storage.DeletedKeys);
    }

    [Fact]
    public async Task Listing_a_posts_media_is_only_for_its_author()
    {
        await using var harness = await TestHarness.CreateAsync();
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var theirs = await harness.AddAuthorAsync("theirs@example.com", "a long enough password");
        var theirPost = await harness.AddPostAsync(theirs);
        harness.SignIn(mine);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            harness.MediaService.GetForPostAsync(theirPost.Id));
    }

    [Fact]
    public async Task Listing_media_by_slug_hides_a_draft()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var draft = await harness.AddPostAsync(author, isDraft: true);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            harness.MediaService.GetForPublicPostAsync(draft.Slug));
    }

    [Fact]
    public async Task Listing_media_by_slug_returns_a_published_posts_media()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author, isDraft: false);
        harness.SignIn(author);

        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));
        harness.SignOut();

        var media = await harness.MediaService.GetForPublicPostAsync(post.Slug);

        Assert.Single(media);
    }

    [Fact]
    public async Task Deleting_media_removes_the_row_and_the_object()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        await harness.MediaService.DeleteAsync(post.Id, media.Id);

        Assert.Empty(harness.Storage.Objects);
        Assert.Empty(harness.Context.Medias);
    }

    [Fact]
    public async Task Deleting_media_through_the_wrong_posts_route_is_a_404()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        var other = await harness.AddPostAsync(author);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        // The caller owns both posts; the address is still wrong, and one post's URL must
        // not be able to act on another's file.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            harness.MediaService.DeleteAsync(other.Id, media.Id));

        Assert.Single(harness.Storage.Objects);
    }

    [Fact]
    public async Task Deleting_someone_elses_media_is_refused()
    {
        await using var harness = await TestHarness.CreateAsync();
        var mine = await harness.AddAuthorAsync("mine@example.com", "a long enough password");
        var theirs = await harness.AddAuthorAsync("theirs@example.com", "a long enough password");
        var theirPost = await harness.AddPostAsync(theirs);

        harness.SignIn(theirs);
        var media = await harness.MediaService.AddToPostAsync(
            theirPost.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        harness.SignIn(mine);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            harness.MediaService.DeleteAsync(theirPost.Id, media.Id));

        Assert.Single(harness.Storage.Objects);
    }

    [Fact]
    public async Task A_bucket_that_fails_the_delete_keeps_the_row()
    {
        // The bucket goes first on purpose. If it fails, the row survives and the delete can
        // be retried; the other order would leave an object nothing remembers the key of.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        harness.Storage.FailDelete = _ => new InvalidOperationException("the bucket is down");

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            harness.MediaService.DeleteAsync(post.Id, media.Id));

        Assert.Single(harness.Context.Medias);
    }

    [Fact]
    public async Task A_drafts_media_is_a_404_for_a_stranger()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var draft = await harness.AddPostAsync(author, isDraft: true);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            draft.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        harness.SignOut();

        // A 404 rather than a 403: a 403 would confirm to a stranger that an unpublished
        // post holds a picture at this id, which is what a draft is meant not to say.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            harness.MediaService.GetContentUrlAsync(media.Id));
    }

    [Fact]
    public async Task A_drafts_media_is_readable_by_its_own_author()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var draft = await harness.AddPostAsync(author, isDraft: true);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            draft.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        var url = await harness.MediaService.GetContentUrlAsync(media.Id);

        var stored = harness.Context.Medias.Single();
        Assert.Contains(stored.ObjectKey, url.ToString());
    }

    [Fact]
    public async Task A_published_posts_media_is_readable_by_anyone()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author, isDraft: false);
        harness.SignIn(author);

        var media = await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        harness.SignOut();

        var url = await harness.MediaService.GetContentUrlAsync(media.Id);
        Assert.NotNull(url);
    }

    [Fact]
    public async Task A_content_url_for_an_unknown_id_is_a_404()
    {
        await using var harness = await TestHarness.CreateAsync();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            harness.MediaService.GetContentUrlAsync(9999));
    }
}
