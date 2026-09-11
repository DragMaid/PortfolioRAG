using Backend.Common.Exceptions;
using Backend.Models.DTOs;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

/// <summary>
/// The profile the studio writes and the landing page is rendered from: the copy on the
/// account, the timeline hanging off it, and the contact links beside it. The ownership
/// rule is the same one posts have — an author acts only on their own.
/// </summary>
public class ProfileTests
{
    [Fact]
    public async Task The_portfolio_copy_round_trips_through_an_update()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com", "a long enough password");
        harness.SignIn(author);

        var updated = await harness.AuthorService.UpdateAsync(author.Id, new UpdateAuthorDto
        {
            Name = "Alexander Vance",
            Email = "a@example.com",
            Title = "Staff Systems Engineer",
            Headline = "Designing high-throughput computing engines.",
            Biography = "First paragraph.\n\nSecond **paragraph**.",
            FooterBio = "Short version for the footer.",
            Location = "San Francisco, CA",
            Availability = "Open for Staff roles",
            Focus = "Primary focus: Systems / C++ / Rust",
            ContactPitch = "Currently discussing staff infrastructure roles.",
        });

        Assert.Equal("Staff Systems Engineer", updated.Title);
        Assert.Equal("Designing high-throughput computing engines.", updated.Headline);
        Assert.Equal("First paragraph.\n\nSecond **paragraph**.", updated.Biography);
        Assert.Equal("Short version for the footer.", updated.FooterBio);
        Assert.Equal("Primary focus: Systems / C++ / Rust", updated.Focus);
        Assert.Equal("Currently discussing staff infrastructure roles.", updated.ContactPitch);
    }

    [Fact]
    public async Task Blank_profile_copy_is_stored_as_nothing_rather_than_as_whitespace()
    {
        // The landing page falls back per field on null. A field holding "   " is not empty
        // to that check, and would render as a gap where the fallback should have been.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var updated = await harness.AuthorService.UpdateAsync(author.Id, new UpdateAuthorDto
        {
            Name = "A",
            Email = "a@example.com",
            Title = "   ",
            Location = "",
        });

        Assert.Null(updated.Title);
        Assert.Null(updated.Location);
    }

    [Fact]
    public async Task The_timeline_comes_back_oldest_first_whatever_order_it_was_written_in()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        await harness.AuthorService.AddExperienceAsync(NewJob("OpenAI", 2023, endedYear: null));
        await harness.AuthorService.AddExperienceAsync(NewJob("Stripe", 2019, endedYear: 2021));
        await harness.AuthorService.AddExperienceAsync(NewJob("Vercel", 2021, endedYear: 2023));

        var timeline = await harness.AuthorService.GetExperiencesAsync(author.Id);

        Assert.Equal(["Stripe", "Vercel", "OpenAI"], timeline.Select(e => e.Company));

        // The current role is the one with no end date; the page prints "Present" from it.
        Assert.Null(timeline[^1].EndedOn);
    }

    [Fact]
    public async Task The_profile_carries_its_timeline_and_channels_so_one_read_renders_the_page()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        await harness.AuthorService.AddExperienceAsync(NewJob("Stripe", 2019, endedYear: 2021));
        await harness.AuthorService.AddContactChannelAsync(new ContactChannelInputDto
        {
            Label = "github.com/avance",
            Url = "https://github.com/avance",
        });

        var profile = await harness.AuthorService.GetByIdAsync(author.Id);

        Assert.Equal("Stripe", Assert.Single(profile.Experiences).Company);
        Assert.Equal("https://github.com/avance", Assert.Single(profile.ContactChannels).Url);
    }

    [Fact]
    public async Task A_job_cannot_end_before_it_started()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        await Assert.ThrowsAsync<ValidationException>(() =>
            harness.AuthorService.AddExperienceAsync(new ExperienceInputDto
            {
                Company = "Stripe",
                Role = "Engineer",
                StartedOn = new DateOnly(2021, 1, 1),
                EndedOn = new DateOnly(2019, 1, 1),
            }));
    }

    [Fact]
    public async Task Another_authors_timeline_entry_cannot_be_edited_or_deleted()
    {
        await using var harness = await TestHarness.CreateAsync();
        var mine = await harness.AddAuthorAsync("mine@example.com");
        var theirs = await harness.AddAuthorAsync("theirs@example.com");

        harness.SignIn(theirs);
        var theirJob = await harness.AuthorService.AddExperienceAsync(NewJob("Stripe", 2019, endedYear: 2021));

        harness.SignIn(mine);

        // Readable — the timeline is public — but not writable.
        Assert.Equal("Stripe", (await harness.AuthorService.GetExperienceAsync(theirJob.Id)).Company);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            harness.AuthorService.UpdateExperienceAsync(theirJob.Id, NewJob("Mine now", 2019, endedYear: 2021)));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            harness.AuthorService.DeleteExperienceAsync(theirJob.Id));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            harness.MediaService.SetExperienceLogoAsync(
                theirJob.Id,
                TestFiles.FormFile(TestFiles.Png(), "logo.png", "image/png")));
    }

    [Fact]
    public async Task Another_authors_contact_channel_cannot_be_edited_or_deleted()
    {
        await using var harness = await TestHarness.CreateAsync();
        var mine = await harness.AddAuthorAsync("mine@example.com");
        var theirs = await harness.AddAuthorAsync("theirs@example.com");

        harness.SignIn(theirs);
        var theirChannel = await harness.AuthorService.AddContactChannelAsync(new ContactChannelInputDto
        {
            Label = "github.com/theirs",
            Url = "https://github.com/theirs",
        });

        harness.SignIn(mine);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            harness.AuthorService.UpdateContactChannelAsync(theirChannel.Id, new ContactChannelInputDto
            {
                Label = "mine",
                Url = "https://github.com/mine",
            }));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            harness.AuthorService.DeleteContactChannelAsync(theirChannel.Id));
    }

    [Theory]
    [InlineData("https://github.com/avance")]
    [InlineData("github.com/avance")]
    [InlineData("mailto:me@example.com")]
    [InlineData("me@example.com")]
    [InlineData("+44 20 7946 0958")]
    [InlineData("https://code.example.com/~avance/")]
    [InlineData("gemini://example.org/capsule")]
    public async Task Any_address_is_stored_exactly_as_it_was_written(string url)
    {
        // Nothing here parses an address, adds a scheme to it or decides what service it
        // belongs to, so there is no set of addresses this refuses or quietly rewrites. The
        // logo beside it is the reader's problem — see lib/contactChannels.ts.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var channel = await harness.AuthorService.AddContactChannelAsync(new ContactChannelInputDto
        {
            Label = "A link",
            Url = url,
        });

        Assert.Equal(url, channel.Url);

        var reread = Assert.Single(await harness.AuthorService.GetContactChannelsAsync(author.Id));
        Assert.Equal(url, reread.Url);
    }

    [Fact]
    public async Task Surrounding_whitespace_is_trimmed_off_an_address()
    {
        // The one thing that is touched: a pasted address usually brings a space with it,
        // and a trailing space is not part of anybody's URL.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var channel = await harness.AuthorService.AddContactChannelAsync(new ContactChannelInputDto
        {
            Label = "  github.com/avance  ",
            Url = "  https://github.com/avance  ",
        });

        Assert.Equal("https://github.com/avance", channel.Url);
        Assert.Equal("github.com/avance", channel.Label);
    }

    [Fact]
    public async Task A_company_logo_is_stored_under_its_own_experience_and_swept_up_with_it()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var job = await harness.AuthorService.AddExperienceAsync(NewJob("Stripe", 2019, endedYear: 2021));

        var withLogo = await harness.MediaService.SetExperienceLogoAsync(
            job.Id,
            TestFiles.FormFile(TestFiles.Png(512, 512), "stripe.png", "image/png"));

        Assert.Equal($"/api/experiences/{job.Id}/logo", withLogo.LogoUrl);

        var stored = harness.Context.Experiences.AsNoTracking().Single(e => e.Id == job.Id);
        Assert.StartsWith($"authors/{author.Id}/experiences/{job.Id}/", stored.LogoObjectKey);
        Assert.True(harness.Storage.Objects.ContainsKey(stored.LogoObjectKey!));

        await harness.AuthorService.DeleteExperienceAsync(job.Id);

        Assert.False(harness.Storage.Objects.ContainsKey(stored.LogoObjectKey!));
        Assert.False(await harness.Context.Experiences.AnyAsync(e => e.Id == job.Id));
    }

    [Fact]
    public async Task Replacing_a_logo_drops_the_one_it_replaced()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var job = await harness.AuthorService.AddExperienceAsync(NewJob("Stripe", 2019, endedYear: 2021));

        await harness.MediaService.SetExperienceLogoAsync(
            job.Id, TestFiles.FormFile(TestFiles.Png(), "first.png", "image/png"));

        var first = harness.Context.Experiences.AsNoTracking().Single(e => e.Id == job.Id).LogoObjectKey!;

        await harness.MediaService.SetExperienceLogoAsync(
            job.Id, TestFiles.FormFile(TestFiles.Png(), "second.png", "image/png"));

        var second = harness.Context.Experiences.AsNoTracking().Single(e => e.Id == job.Id).LogoObjectKey!;

        Assert.NotEqual(first, second);
        Assert.False(harness.Storage.Objects.ContainsKey(first));
        Assert.True(harness.Storage.Objects.ContainsKey(second));

        var cleared = await harness.MediaService.RemoveExperienceLogoAsync(job.Id);

        Assert.Null(cleared.LogoUrl);
        Assert.False(harness.Storage.Objects.ContainsKey(second));
    }

    [Fact]
    public async Task A_company_logo_has_to_be_a_picture()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var job = await harness.AuthorService.AddExperienceAsync(NewJob("Stripe", 2019, endedYear: 2021));

        await Assert.ThrowsAsync<UnsupportedMediaTypeException>(() =>
            harness.MediaService.SetExperienceLogoAsync(
                job.Id,
                TestFiles.FormFile(TestFiles.Mp4(), "logo.mp4", "video/mp4")));
    }

    [Fact]
    public async Task Closing_an_account_takes_its_timeline_and_channels_with_it()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("a@example.com");
        harness.SignIn(author);

        var job = await harness.AuthorService.AddExperienceAsync(NewJob("Stripe", 2019, endedYear: 2021));
        await harness.AuthorService.AddContactChannelAsync(new ContactChannelInputDto
        {
            Label = "github.com/avance",
            Url = "https://github.com/avance",
        });

        await harness.MediaService.SetExperienceLogoAsync(
            job.Id, TestFiles.FormFile(TestFiles.Png(), "logo.png", "image/png"));

        await harness.AuthorService.DeleteAsync(author.Id);

        Assert.False(await harness.Context.Experiences.AnyAsync(e => e.AuthorId == author.Id));
        Assert.False(await harness.Context.ContactChannels.AnyAsync(c => c.AuthorId == author.Id));
        Assert.Empty(harness.Storage.Objects);
    }

    private static ExperienceInputDto NewJob(string company, int startedYear, int? endedYear) => new()
    {
        Company = company,
        Role = $"Engineer at {company}",
        Team = "A team",
        Description = $"What I did at **{company}**.",
        StartedOn = new DateOnly(startedYear, 1, 1),
        EndedOn = endedYear is null ? null : new DateOnly(endedYear.Value, 1, 1),
    };
}
