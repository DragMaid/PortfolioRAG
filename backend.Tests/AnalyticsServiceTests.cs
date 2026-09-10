using Backend.Models.DTOs.Analytics;
using Backend.Services;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

/// <summary>
/// Readership telemetry. Two things matter here beyond the arithmetic: a reading is counted
/// for exactly one author, and nothing a reader's browser sends can be trusted — a bad slug
/// or a junk referrer has to be absorbed rather than answered with an error.
/// </summary>
public class AnalyticsServiceTests
{
    [Fact]
    public async Task Reading_a_published_post_is_counted_for_its_author()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);

        await harness.Analytics.RecordAsync(View(post.Slug, dwellSeconds: 90));

        var view = harness.Context.PageViews.Single();
        Assert.Equal(post.Id, view.PostId);
        Assert.Equal(author.Id, view.AuthorId);
        Assert.Equal(90, view.DwellSeconds);
    }

    [Fact]
    public async Task Recording_a_reading_advances_the_post_s_lifetime_counter()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);

        await harness.Analytics.RecordAsync(View(post.Slug));
        await harness.Analytics.RecordAsync(View(post.Slug));

        // The one write path: the counter on the post and the telemetry behind the dashboard
        // are kept in step by the same call, so they cannot disagree.
        Assert.Equal(2, (await harness.Context.Posts.AsNoTracking().SingleAsync(p => p.Id == post.Id)).ViewCount);
    }

    [Fact]
    public async Task A_draft_is_recorded_as_a_page_and_counted_for_nobody()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: true);

        await harness.Analytics.RecordAsync(View(post.Slug));

        // Its author is the only one who can open a draft, and a dashboard reporting the
        // author reading their own unpublished work is noise.
        var view = harness.Context.PageViews.Single();
        Assert.Null(view.PostId);
        Assert.Null(view.AuthorId);
        Assert.Equal(0, (await harness.Context.Posts.AsNoTracking().SingleAsync(p => p.Id == post.Id)).ViewCount);
    }

    [Fact]
    public async Task A_slug_that_names_nothing_is_absorbed_rather_than_refused()
    {
        await using var harness = await TestHarness.CreateAsync();

        // Telemetry must never be able to fail the page it is reporting on.
        await harness.Analytics.RecordAsync(View("no-such-post"));

        Assert.Null(harness.Context.PageViews.Single().PostId);
    }

    [Fact]
    public async Task The_address_and_user_agent_are_hashed_rather_than_stored()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);

        harness.AsVisitor("198.51.100.7", "Mozilla/5.0 (a very particular browser)");
        await harness.Analytics.RecordAsync(View(post.Slug));

        var view = harness.Context.PageViews.Single();
        Assert.DoesNotContain("198.51.100.7", view.VisitorHash);
        Assert.DoesNotContain("Mozilla", view.VisitorHash);
        Assert.Equal(64, view.VisitorHash.Length);
    }

    [Fact]
    public async Task One_reader_counts_once_a_day_and_two_readers_count_twice()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);
        harness.SignIn(author);

        harness.AsVisitor("198.51.100.1", "agent-one");
        await harness.Analytics.RecordAsync(View(post.Slug));
        await harness.Analytics.RecordAsync(View(post.Slug));

        harness.AsVisitor("198.51.100.2", "agent-two");
        await harness.Analytics.RecordAsync(View(post.Slug));

        var summary = await harness.Analytics.GetSummaryAsync(7);

        Assert.Equal(2, summary.UniqueVisitors.Value);
        Assert.Equal(3, summary.Reads.Value);
    }

    [Fact]
    public async Task The_same_reader_on_a_later_day_is_a_new_visitor()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);
        harness.SignIn(author);

        await harness.Analytics.RecordAsync(View(post.Slug));

        // The salt rotates at midnight UTC, so yesterday's hash cannot be matched to today's.
        // That is the point — it is what stops the hash being a durable identity — and the
        // cost is that a returning reader is counted again.
        harness.TimeProvider.Advance(TimeSpan.FromDays(1));
        await harness.Analytics.RecordAsync(View(post.Slug));

        Assert.Equal(2, (await harness.Analytics.GetSummaryAsync(7)).UniqueVisitors.Value);
    }

    [Theory]
    [InlineData("https://news.ycombinator.com/item?id=1", "news.ycombinator.com")]
    [InlineData("https://www.github.com/someone/repo", "github.com")]
    [InlineData("HTTPS://X.COM/Post", "x.com")]
    public async Task A_referrer_is_reduced_to_its_host(string referrer, string expected)
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);

        await harness.Analytics.RecordAsync(View(post.Slug, referrer: referrer));

        Assert.Equal(expected, harness.Context.PageViews.Single().ReferrerHost);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not a url")]
    [InlineData("https://example.com/another-page")]
    public async Task Nothing_usable_and_this_site_itself_are_both_direct(string? referrer)
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);

        // example.com is this harness's own host, so a reader moving between its pages is
        // not an inbound source.
        await harness.Analytics.RecordAsync(View(post.Slug, referrer: referrer));

        Assert.Null(harness.Context.PageViews.Single().ReferrerHost);
    }

    [Fact]
    public async Task An_author_never_sees_another_author_s_numbers()
    {
        await using var harness = await TestHarness.CreateAsync();
        var mine = await harness.AddAuthorAsync("mine@example.com");
        var theirs = await harness.AddAuthorAsync("theirs@example.com");

        var myPost = await harness.AddPostAsync(mine, isDraft: false);
        var theirPost = await harness.AddPostAsync(theirs, isDraft: false);

        await harness.Analytics.RecordAsync(View(myPost.Slug));
        await harness.Analytics.RecordAsync(View(theirPost.Slug));
        await harness.Analytics.RecordAsync(View(theirPost.Slug));

        harness.SignIn(mine);
        var summary = await harness.Analytics.GetSummaryAsync(7);

        Assert.Equal(1, summary.Reads.Value);
        Assert.Equal(myPost.Id, Assert.Single(summary.TopPosts).PostId);
    }

    [Fact]
    public async Task Readings_with_no_reported_duration_stay_out_of_the_average()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);
        harness.SignIn(author);

        await harness.Analytics.RecordAsync(View(post.Slug, dwellSeconds: 100));
        await harness.Analytics.RecordAsync(View(post.Slug, dwellSeconds: 200));

        // A reader who closed the tab before the beacon fired did not spend no time here;
        // averaging them in as zero would drag the figure down for everyone else.
        await harness.Analytics.RecordAsync(View(post.Slug, dwellSeconds: 0));

        Assert.Equal(150, (await harness.Analytics.GetSummaryAsync(7)).AvgDwellSeconds.Value);
    }

    [Fact]
    public async Task A_tab_left_open_for_a_week_is_clamped_to_a_day()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);

        await harness.Analytics.RecordAsync(View(post.Slug, dwellSeconds: int.MaxValue));

        Assert.Equal(86400, harness.Context.PageViews.Single().DwellSeconds);
    }

    [Fact]
    public async Task The_window_is_padded_out_to_one_row_per_day()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);
        harness.SignIn(author);

        await harness.Analytics.RecordAsync(View(post.Slug));

        var summary = await harness.Analytics.GetSummaryAsync(7);

        // The database only reports days something happened on. A chart with days missing
        // from the middle reads as a different shape entirely.
        Assert.Equal(7, summary.Daily.Count);
        Assert.Equal(1, summary.Daily[^1].Reads);
        Assert.All(summary.Daily.Take(summary.Daily.Count - 1), day => Assert.Equal(0, day.Reads));

        // Oldest first, one calendar day apart.
        Assert.Equal(
            summary.Daily.Select(d => d.Date).OrderBy(d => d).ToArray(),
            summary.Daily.Select(d => d.Date).ToArray());
    }

    [Fact]
    public async Task A_change_against_an_empty_previous_window_is_null_rather_than_zero()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);
        harness.SignIn(author);

        await harness.Analytics.RecordAsync(View(post.Slug));

        // Nothing happened in the window before, so there is no change to report — and a
        // dashboard drawing that as +0.0% would be claiming a flat week that never was.
        Assert.Null((await harness.Analytics.GetSummaryAsync(7)).Reads.Change);
    }

    [Fact]
    public async Task A_change_is_measured_against_the_window_immediately_before()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);
        harness.SignIn(author);

        await harness.Analytics.RecordAsync(View(post.Slug));
        await harness.Analytics.RecordAsync(View(post.Slug));

        harness.TimeProvider.Advance(TimeSpan.FromDays(7));
        await harness.Analytics.RecordAsync(View(post.Slug));
        await harness.Analytics.RecordAsync(View(post.Slug));
        await harness.Analytics.RecordAsync(View(post.Slug));

        var summary = await harness.Analytics.GetSummaryAsync(7);

        Assert.Equal(3, summary.Reads.Value);
        Assert.Equal(2, summary.Reads.PreviousValue);
        Assert.Equal(0.5, summary.Reads.Change);
    }

    [Fact]
    public async Task Shares_are_a_fraction_of_the_window_s_readings()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var loud = await harness.AddPostAsync(author, isDraft: false, title: "Loud");
        var quiet = await harness.AddPostAsync(author, isDraft: false, title: "Quiet");
        harness.SignIn(author);

        await harness.Analytics.RecordAsync(View(loud.Slug, referrer: "https://news.ycombinator.com/x"));
        await harness.Analytics.RecordAsync(View(loud.Slug, referrer: "https://news.ycombinator.com/x"));
        await harness.Analytics.RecordAsync(View(loud.Slug, referrer: "https://news.ycombinator.com/x"));
        await harness.Analytics.RecordAsync(View(quiet.Slug, referrer: "https://github.com/x"));

        var summary = await harness.Analytics.GetSummaryAsync(7);

        Assert.Equal(0.75, summary.TopPosts.Single(p => p.PostId == loud.Id).Share);
        Assert.Equal(0.25, summary.TopPosts.Single(p => p.PostId == quiet.Id).Share);
        Assert.Equal(0.75, summary.Referrers.Single(r => r.Host == "news.ycombinator.com").Share);
    }

    [Fact]
    public async Task Top_posts_and_referrers_come_back_busiest_first()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var quiet = await harness.AddPostAsync(author, isDraft: false, title: "Quiet");
        var loud = await harness.AddPostAsync(author, isDraft: false, title: "Loud");
        harness.SignIn(author);

        await harness.Analytics.RecordAsync(View(quiet.Slug, referrer: "https://github.com/x"));
        await harness.Analytics.RecordAsync(View(loud.Slug, referrer: "https://news.ycombinator.com/x"));
        await harness.Analytics.RecordAsync(View(loud.Slug, referrer: "https://news.ycombinator.com/x"));

        var summary = await harness.Analytics.GetSummaryAsync(7);

        Assert.Equal(loud.Id, summary.TopPosts[0].PostId);
        Assert.Equal("news.ycombinator.com", summary.Referrers[0].Host);
    }

    [Fact]
    public async Task The_window_is_clamped_rather_than_refused()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        Assert.Equal(
            AnalyticsService.MaxWindowDays,
            (await harness.Analytics.GetSummaryAsync(10_000)).WindowDays);

        Assert.Equal(
            AnalyticsService.MinWindowDays,
            (await harness.Analytics.GetSummaryAsync(1)).WindowDays);

        // Zero or less reads as "unspecified" rather than as a one-day window: nobody asks
        // for minus five days on purpose, and the default is the more useful answer.
        Assert.Equal(
            AnalyticsService.DefaultWindowDays,
            (await harness.Analytics.GetSummaryAsync(0)).WindowDays);

        Assert.Equal(
            AnalyticsService.DefaultWindowDays,
            (await harness.Analytics.GetSummaryAsync(-5)).WindowDays);
    }

    [Fact]
    public async Task Reading_the_summary_requires_a_signed_in_author()
    {
        await using var harness = await TestHarness.CreateAsync();

        await Assert.ThrowsAsync<Backend.Common.Exceptions.UnauthorizedException>(
            () => harness.Analytics.GetSummaryAsync(7));
    }

    [Fact]
    public async Task The_export_is_one_csv_row_per_day_of_the_window()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        var post = await harness.AddPostAsync(author, isDraft: false);
        harness.SignIn(author);

        await harness.Analytics.RecordAsync(View(post.Slug));

        var csv = await harness.Analytics.ExportCsvAsync(7);
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal("date,visitors,reads,baseline", lines[0]);
        Assert.Equal(8, lines.Length);
        Assert.EndsWith(",1,1,0", lines[^1]);
    }

    private static TrackViewDto View(string? slug, string? referrer = null, int dwellSeconds = 60) =>
        new()
        {
            Path = slug is null ? "/" : $"/posts/{slug}",
            Slug = slug,
            Referrer = referrer,
            DwellSeconds = dwellSeconds,
        };
}
