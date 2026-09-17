using Backend.Common.Exceptions;
using Backend.Models.DTOs;
using Backend.Models.DTOs.Llm;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

/// <summary>
/// The index follows the portfolio on its own: every change that alters what should be
/// searchable marks its source queued and leaves exactly one rebuild waiting.
/// </summary>
public class RagIndexSchedulerTests
{
    private const string Key = "sk-ant-api03-a-perfectly-plausible-looking-key";

    private static SaveLlmCredentialDto Save() => new() { Provider = LlmProvider.Anthropic, ApiKey = Key };

    [Fact]
    public async Task SavingAKeyQueuesEveryIndexableSourceButNotDrafts()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.SignIn(author);

        var live = await harness.AddPostAsync(author, isDraft: false, title: "Live post");
        await harness.AddPostAsync(author, isDraft: true, title: "Draft post");
        var job = await harness.AuthorService.AddExperienceAsync(new ExperienceInputDto
        {
            Company = "Helio",
            Role = "Engineer",
            StartedOn = new DateOnly(2020, 1, 1)
        });

        await harness.LlmCredentials.SaveAsync(Save());

        var sources = await harness.Context.RagSources.AsNoTracking().ToListAsync();

        Assert.Equal(3, sources.Count);
        Assert.All(sources, source => Assert.Equal(RagSourceStatus.Queued, source.Status));
        Assert.Contains(sources, s => s.SourceType == RagSourceType.Post && s.SourceId == live.Id && s.Label == "Live post");
        Assert.Contains(sources, s => s.SourceType == RagSourceType.Experience && s.SourceId == job.Id && s.Label == "Helio — Engineer");
        Assert.Contains(sources, s => s.SourceType == RagSourceType.Profile);

        Assert.Single(await harness.Context.RagJobs.Where(j => j.Kind == RagJobKind.Index).ToListAsync());
    }

    [Fact]
    public async Task WithoutAKeyContentChangesQueueNothing()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.SignIn(author);

        var post = await harness.AddPostAsync(author, isDraft: false);
        await harness.PostService.UpdateAsync(post.Id, new UpdatePostDto { Title = "Renamed", Body = "body" });

        Assert.Empty(await harness.Context.RagSources.ToListAsync());
        Assert.Empty(await harness.Context.RagJobs.ToListAsync());
    }

    [Fact]
    public async Task EditingALivePostRequeuesItWithoutStackingRebuilds()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.SignIn(author);

        var post = await harness.AddPostAsync(author, isDraft: false, title: "Before");
        await harness.LlmCredentials.SaveAsync(Save());

        // The worker settled it.
        var row = await harness.Context.RagSources.SingleAsync(s => s.SourceType == RagSourceType.Post);
        row.Status = RagSourceStatus.Failed;
        row.Error = "Something went wrong.";
        await harness.Context.SaveChangesAsync();

        await harness.PostService.UpdateAsync(post.Id, new UpdatePostDto { Title = "After", Body = "new body" });
        await harness.PostService.UpdateAsync(post.Id, new UpdatePostDto { Title = "After again", Body = "newer" });

        var source = await harness.Context.RagSources.AsNoTracking()
            .SingleAsync(s => s.SourceType == RagSourceType.Post);

        Assert.Equal(RagSourceStatus.Queued, source.Status);
        Assert.Null(source.Error);
        Assert.Equal("After again", source.Label);
        Assert.Single(await harness.Context.RagJobs.Where(j => j.Kind == RagJobKind.Index).ToListAsync());
    }

    [Fact]
    public async Task ANewRebuildIsQueuedWhenTheWaitingOneHasAlreadyBeenClaimed()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.SignIn(author);

        var post = await harness.AddPostAsync(author, isDraft: false);
        await harness.LlmCredentials.SaveAsync(Save());

        var running = await harness.Context.RagJobs.SingleAsync();
        running.Status = RagJobStatus.Running;
        await harness.Context.SaveChangesAsync();

        await harness.PostService.UpdateAsync(post.Id, new UpdatePostDto { Title = "Changed", Body = "body" });

        Assert.Equal(2, await harness.Context.RagJobs.CountAsync(j => j.Kind == RagJobKind.Index));
    }

    [Fact]
    public async Task EditingADraftLeavesTheIndexAlone()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.SignIn(author);

        await harness.LlmCredentials.SaveAsync(Save());
        var draft = await harness.AddPostAsync(author, isDraft: true);

        await harness.PostService.UpdateAsync(draft.Id, new UpdatePostDto { Title = "Still a draft", Body = "body" });

        Assert.DoesNotContain(
            await harness.Context.RagSources.ToListAsync(),
            source => source.SourceType == RagSourceType.Post);
    }

    [Fact]
    public async Task UnpublishingDropsTheRowAndQueuesTheCleanup()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.SignIn(author);

        var post = await harness.AddPostAsync(author, isDraft: false);
        await harness.LlmCredentials.SaveAsync(Save());

        // Pretend the first build ran, so the unpublish has to queue its own.
        await harness.Context.RagJobs.ExecuteUpdateAsync(set => set.SetProperty(j => j.Status, RagJobStatus.Succeeded));

        await harness.PostService.UnpublishAsync(post.Id);

        Assert.DoesNotContain(
            await harness.Context.RagSources.ToListAsync(),
            source => source.SourceType == RagSourceType.Post);
        Assert.Single(await harness.Context.RagJobs.Where(j => j.Status == RagJobStatus.Queued).ToListAsync());
    }

    [Fact]
    public async Task RemovingTheKeyForgetsTheSources()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.SignIn(author);

        await harness.AddPostAsync(author, isDraft: false);
        await harness.LlmCredentials.SaveAsync(Save());
        await harness.LlmCredentials.DeleteAsync();

        Assert.Empty(await harness.Context.RagSources.ToListAsync());
    }

    [Fact]
    public async Task TheStudioSeesEverySourceWithItsFailureReason()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.SignIn(author);

        await harness.AddPostAsync(author, isDraft: false, title: "Too short");
        await harness.LlmCredentials.SaveAsync(Save());

        var row = await harness.Context.RagSources.SingleAsync(s => s.SourceType == RagSourceType.Post);
        row.Status = RagSourceStatus.Failed;
        row.Error = "Nothing long enough to index.";
        await harness.Context.SaveChangesAsync();

        var credential = await harness.LlmCredentials.GetAsync();
        var failed = Assert.Single(credential!.Index.Sources, s => s.SourceType == RagSourceType.Post);

        Assert.Equal(RagSourceStatus.Failed, failed.Status);
        Assert.Equal("Nothing long enough to index.", failed.Error);
    }

    /* ---------------------------------------------------------------------- */
    /* Cover letters                                                          */
    /* ---------------------------------------------------------------------- */

    private static CoverLetterRequestDto Letter() => new()
    {
        JobDescription = new string('x', 50) +
            " Senior Backend Engineer. We need somebody who has operated a distributed " +
            "storage system in production, writes Rust or Go, and is comfortable carrying " +
            "a pager for what they build.",
        Notes = "Lead with the storage work."
    };

    [Fact]
    public async Task ACoverLetterIsQueuedWithTheNotesForTheWorker()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.SignIn(author);
        await harness.LlmCredentials.SaveAsync(Save());

        var job = await harness.LlmCredentials.WriteCoverLetterAsync(Letter());

        var row = await harness.Context.RagJobs.AsNoTracking().SingleAsync(j => j.Id == job.Id);

        Assert.Equal(RagJobKind.CoverLetter, row.Kind);
        Assert.Contains("Lead with the storage work.", row.PayloadJson, StringComparison.Ordinal);

        // The role and company are the worker's to read out of the posting, not the caller's.
        Assert.DoesNotContain("role_title", row.PayloadJson, StringComparison.Ordinal);
        Assert.DoesNotContain("\"company\"", row.PayloadJson, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AFinishedCoverLetterIsReadBackAndNeverServedPublicly()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.SignIn(author);
        await harness.LlmCredentials.SaveAsync(Save());

        var job = await harness.LlmCredentials.WriteCoverLetterAsync(Letter());

        var row = await harness.Context.RagJobs.SingleAsync(j => j.Id == job.Id);
        row.Status = RagJobStatus.Succeeded;
        row.ResultJson = """
            {
              "letter": "Dear Acme,\n\nI rewrote a write-ahead log in Rust.",
              "role_title": "Senior Backend Engineer",
              "company": "Acme",
              "sources": [{ "document_id": 7, "source_type": "post", "source_label": "WAL rewrite" }],
              "usage": { "provider": "anthropic", "model": "m", "input_tokens": 10, "output_tokens": 5, "cost_usd": "0.01", "duration_ms": 100 }
            }
            """;
        await harness.Context.SaveChangesAsync();

        var letter = (await harness.LlmCredentials.GetOwnJobAsync(job.Id)).CoverLetter!;

        Assert.StartsWith("Dear Acme", letter.Letter, StringComparison.Ordinal);
        Assert.Equal(RagSourceType.Post, Assert.Single(letter.Sources).SourceType);

        harness.CurrentUser.AuthorId = null;
        await Assert.ThrowsAsync<NotFoundException>(() => harness.JobFit.GetJobAsync(job.Id));
    }
}
