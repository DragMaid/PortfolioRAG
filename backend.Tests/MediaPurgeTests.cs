using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

/// <summary>
/// Deleting a post or an account clears the database by cascade, and the database is the
/// only thing that remembers where the files are. These sweeps are the last chance to take
/// the bucket with it — and they are best effort, because a storage outage must not be able
/// to keep somebody's account open.
/// </summary>
public class MediaPurgeTests
{
    [Fact]
    public async Task Deleting_a_post_empties_its_folder_in_the_bucket()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(64, 64, noisy: true), "one.png", "image/png"));
        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(48, 48, noisy: true), "two.png", "image/png"));

        await harness.PostService.DeleteAsync(post.Id);

        Assert.Empty(harness.Storage.Objects);
        Assert.Empty(harness.Context.Medias);
    }

    [Fact]
    public async Task Deleting_a_post_leaves_another_posts_objects_alone()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var doomed = await harness.AddPostAsync(author);
        var keeper = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await harness.MediaService.AddToPostAsync(
            doomed.Id, TestFiles.FormFile(TestFiles.Png(), "gone.png", "image/png"));
        var kept = await harness.MediaService.AddToPostAsync(
            keeper.Id, TestFiles.FormFile(TestFiles.Png(48, 48, noisy: true), "kept.png", "image/png"));

        await harness.PostService.DeleteAsync(doomed.Id);

        // The prefix is per post, which is exactly what stops one delete reaching another.
        Assert.Single(harness.Storage.Objects);
        Assert.Single(harness.Storage.KeysUnder($"authors/{author.Id}/posts/{keeper.Id}/"));
        Assert.Equal(kept.Id, harness.Context.Medias.Single().Id);
    }

    [Fact]
    public async Task Deleting_an_account_empties_everything_it_ever_uploaded()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(64, 64, noisy: true), "photo.png", "image/png"));
        await harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(48, 48, noisy: true), "me.png", "image/png"));

        Assert.Equal(2, harness.Storage.Objects.Count);

        await harness.AuthorService.DeleteAsync(author.Id);

        // Post media and the avatar both live under one prefix, so closing an account is a
        // single sweep — nothing of it survives.
        Assert.Empty(harness.Storage.Objects);
        Assert.Empty(harness.Context.Authors);
    }

    [Fact]
    public async Task A_bucket_that_refuses_to_list_does_not_stop_an_account_being_closed()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        harness.Storage.FailList = _ => new InvalidOperationException("the bucket is down");

        await harness.AuthorService.DeleteAsync(author.Id);

        // The account is gone; the files are logged as orphaned rather than holding it open.
        Assert.Empty(harness.Context.Authors);
        Assert.Single(harness.Storage.Objects);
    }

    [Fact]
    public async Task A_bucket_that_refuses_a_delete_does_not_stop_a_post_being_deleted()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        harness.Storage.FailDelete = _ => new InvalidOperationException("the bucket is down");

        await harness.PostService.DeleteAsync(post.Id);

        Assert.Empty(harness.Context.Posts);
    }

    [Fact]
    public async Task An_object_whose_row_was_already_lost_is_still_swept_up()
    {
        // The sweep reads the bucket rather than the media rows, so a file whose row went
        // missing is still collected instead of being paid for forever.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        var post = await harness.AddPostAsync(author);
        harness.SignIn(author);

        await harness.MediaService.AddToPostAsync(
            post.Id, TestFiles.FormFile(TestFiles.Png(), "photo.png", "image/png"));

        // ExecuteDelete goes straight to the database, so the context is still holding the
        // row it just removed; forget it, the way a fresh request would.
        await harness.Context.Medias.ExecuteDeleteAsync();
        harness.Context.ChangeTracker.Clear();

        Assert.Single(harness.Storage.Objects);

        await harness.PostService.DeleteAsync(post.Id);

        Assert.Empty(harness.Storage.Objects);
    }
}
