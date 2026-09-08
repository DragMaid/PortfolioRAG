using Backend.Common.Exceptions;
using Backend.Mapping;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

/// <summary>
/// An avatar is a file in the bucket and nothing else. There is no provider URL to fall
/// back to any more, so an account either uploaded a picture or it has none.
/// </summary>
public class AvatarTests
{
    [Fact]
    public async Task Setting_an_avatar_stores_it_under_the_authors_prefix()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        await harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(900, 900), "me.png", "image/png"));

        var stored = harness.Context.Authors.Single(a => a.Id == author.Id);
        Assert.NotNull(stored.AvatarObjectKey);
        Assert.StartsWith($"authors/{author.Id}/avatar/", stored.AvatarObjectKey);
        Assert.True(harness.Storage.Objects.ContainsKey(stored.AvatarObjectKey));
    }

    [Fact]
    public async Task An_avatar_is_scaled_to_the_avatar_dimension_not_the_post_one()
    {
        // An avatar is only ever shown small, so it is held to a tighter bound than a
        // picture in the body of a post.
        await using var harness = await TestHarness.CreateAsync(options =>
        {
            options.MaxAvatarDimension = 64;
            options.MaxImageDimension = 2048;
        });

        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        await harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(900, 900), "me.png", "image/png"));

        var stored = harness.Context.Authors.Single(a => a.Id == author.Id);
        using var image = SixLabors.ImageSharp.Image.Load(
            harness.Storage.BytesAt(stored.AvatarObjectKey!));

        Assert.Equal(64, image.Width);
    }

    [Fact]
    public async Task The_profile_points_at_the_avatar_route_once_one_is_uploaded()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        var profile = await harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(), "me.png", "image/png"));

        // Never the bucket key and never a signed URL: the bucket is private, so the only
        // address that keeps working is one on this API.
        Assert.Equal($"/api/authors/{author.Id}/avatar", profile.AvatarUrl);
    }

    [Fact]
    public async Task An_account_that_never_uploaded_an_avatar_has_none()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");

        Assert.Null(author.ResolveAvatarUrl());
        Assert.Null((await harness.AuthorService.GetByIdAsync(author.Id)).AvatarUrl);
    }

    [Fact]
    public async Task Replacing_an_avatar_deletes_the_one_it_replaced()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        await harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(900, 900), "first.png", "image/png"));
        var first = harness.Context.Authors.AsNoTracking().Single(a => a.Id == author.Id).AvatarObjectKey!;

        await harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(800, 800), "second.png", "image/png"));

        var second = harness.Context.Authors.AsNoTracking().Single(a => a.Id == author.Id).AvatarObjectKey!;

        Assert.NotEqual(first, second);
        Assert.Single(harness.Storage.Objects);
        Assert.False(harness.Storage.Objects.ContainsKey(first));
    }

    [Fact]
    public async Task A_bucket_that_will_not_release_the_old_avatar_does_not_fail_the_request()
    {
        // The profile already points at the new picture, so a bucket refusing to let go of
        // the old one leaves a stray object, not a failed request.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        await harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(900, 900), "first.png", "image/png"));
        var first = harness.Context.Authors.AsNoTracking().Single(a => a.Id == author.Id).AvatarObjectKey!;

        harness.Storage.FailDelete = key => key == first ? new InvalidOperationException("stuck") : null;

        var profile = await harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(800, 800), "second.png", "image/png"));

        Assert.Equal($"/api/authors/{author.Id}/avatar", profile.AvatarUrl);
        Assert.True(harness.Storage.Objects.ContainsKey(first));
    }

    [Fact]
    public async Task A_failed_save_removes_the_avatar_it_had_just_stored()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        harness.Authors.FailNextSave = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() => harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(900, 900), "me.png", "image/png")));

        Assert.Empty(harness.Storage.Objects);
    }

    [Fact]
    public async Task Removing_an_avatar_clears_the_key_and_the_object()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        await harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(), "me.png", "image/png"));

        var profile = await harness.MediaService.RemoveAvatarAsync();

        Assert.Null(profile.AvatarUrl);
        Assert.Empty(harness.Storage.Objects);
        Assert.Null(harness.Context.Authors.AsNoTracking().Single(a => a.Id == author.Id).AvatarObjectKey);
    }

    [Fact]
    public async Task Removing_an_avatar_that_was_never_set_is_a_no_op()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        var profile = await harness.MediaService.RemoveAvatarAsync();

        Assert.Null(profile.AvatarUrl);
        Assert.Empty(harness.Storage.DeletedKeys);
    }

    [Fact]
    public async Task An_avatar_cannot_be_a_video()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        await Assert.ThrowsAsync<UnsupportedMediaTypeException>(() => harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Mp4(), "clip.mp4", "video/mp4")));

        Assert.Empty(harness.Storage.Objects);
    }

    [Fact]
    public async Task An_avatar_url_for_an_author_without_one_is_a_404()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");

        await Assert.ThrowsAsync<NotFoundException>(() =>
            harness.MediaService.GetAvatarUrlAsync(author.Id));
    }

    [Fact]
    public async Task An_avatar_url_for_an_author_that_does_not_exist_is_a_404()
    {
        await using var harness = await TestHarness.CreateAsync();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            harness.MediaService.GetAvatarUrlAsync(9999));
    }

    [Fact]
    public async Task Setting_an_avatar_needs_a_signed_in_caller()
    {
        await using var harness = await TestHarness.CreateAsync();
        harness.SignOut();

        await Assert.ThrowsAsync<UnauthorizedException>(() => harness.MediaService.SetAvatarAsync(
            TestFiles.FormFile(TestFiles.Png(), "me.png", "image/png")));
    }
}
