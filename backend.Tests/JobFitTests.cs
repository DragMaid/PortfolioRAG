using Backend.Common.Exceptions;
using Backend.Models.DTOs.Llm;
using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

/// <summary>
/// The rules around the provider key and the public button: what is stored, what is never
/// stored, who may turn it on, and what stops a public endpoint spending somebody's money.
/// </summary>
public class JobFitTests
{
    private const string Key = "sk-ant-api03-a-perfectly-plausible-looking-key";

    private static SaveLlmCredentialDto Save(string? model = null) =>
        new() { Provider = LlmProvider.Anthropic, ApiKey = Key, Model = model };

    private static JobFitRequestDto Posting(string? text = null) => new()
    {
        JobDescription = text ?? new string('x', 50) +
            " Senior Backend Engineer. We need somebody who has operated a distributed " +
            "storage system in production, writes Rust or Go, and is comfortable carrying " +
            "a pager for what they build. Postgres experience required.",
    };

    /* ---------------------------------------------------------------------- */
    /* Storing a key                                                          */
    /* ---------------------------------------------------------------------- */

    [Fact]
    public async Task StoresTheKeySealedAndNeverInTheClear()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());

        var row = await harness.Context.LlmCredentials.AsNoTracking().SingleAsync();

        Assert.DoesNotContain(Key, row.KeyCiphertext, StringComparison.Ordinal);
        Assert.Equal(Key, harness.Protector.Unprotect(row.KeyCiphertext));
    }

    [Fact]
    public async Task NeverReturnsTheKeyToTheCaller()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        var saved = await harness.LlmCredentials.SaveAsync(Save());
        var fetched = await harness.LlmCredentials.GetAsync();

        // The preview is recognisable and useless: the head places it, the tail identifies
        // it, and neither reconstructs it.
        Assert.StartsWith("sk-ant-", saved.KeyPreview, StringComparison.Ordinal);
        Assert.DoesNotContain(Key, saved.KeyPreview, StringComparison.Ordinal);
        Assert.True(saved.KeyPreview.Length < 20);
        Assert.Equal(saved.KeyPreview, fetched!.KeyPreview);
    }

    [Fact]
    public async Task ChecksTheKeyWithTheProviderBeforeStoringIt()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());

        Assert.Equal([Key], harness.Provider.Validated);
    }

    [Fact]
    public async Task RefusesAKeyTheProviderRejects()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;
        harness.Provider.Reject("Anthropic rejected that key.");

        await Assert.ThrowsAsync<ValidationException>(() => harness.LlmCredentials.SaveAsync(Save()));

        Assert.Empty(await harness.Context.LlmCredentials.ToListAsync());
    }

    [Fact]
    public async Task RefusesSomethingThatIsNotShapedLikeAKeyWithoutAskingTheProvider()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await Assert.ThrowsAsync<ValidationException>(
            () => harness.LlmCredentials.SaveAsync(new SaveLlmCredentialDto { ApiKey = "hunter2xxxxx" }));

        Assert.Empty(harness.Provider.Validated);
    }

    [Fact]
    public async Task AnUnreachableProviderDoesNotReplaceAWorkingKey()
    {
        // The distinction that matters: a rejected key is the author's problem to fix, an
        // unreachable provider is nobody's, and conflating them means somebody deleting a
        // key that was fine because of somebody else's outage.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());
        harness.Provider.GoOffline();

        await Assert.ThrowsAsync<NotConfiguredException>(
            () => harness.LlmCredentials.SaveAsync(new SaveLlmCredentialDto { ApiKey = Key + "-new" }));

        var stored = await harness.Context.LlmCredentials.AsNoTracking().SingleAsync();

        Assert.Equal(Key, harness.Protector.Unprotect(stored.KeyCiphertext));
        Assert.NotNull(stored.ValidatedAt);
    }

    [Fact]
    public async Task RevalidationLeavesAWorkingKeyAloneWhenTheProviderIsDown()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());
        harness.Provider.GoOffline();

        await Assert.ThrowsAsync<NotConfiguredException>(() => harness.LlmCredentials.RevalidateAsync());

        Assert.NotNull((await harness.LlmCredentials.GetAsync())!.ValidatedAt);
    }

    [Fact]
    public async Task RevalidationMarksAKeyTheProviderNowRefusesAsUnusable()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());
        harness.Provider.Reject("The key has been revoked.");

        var result = await harness.LlmCredentials.RevalidateAsync();

        Assert.False(result.IsUsable);
        Assert.Equal("The key has been revoked.", result.ValidationError);
    }

    [Fact]
    public async Task RefusesAModelTheKeyMayNotUse()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;
        harness.Provider.Accept("claude-opus-5");

        await Assert.ThrowsAsync<ValidationException>(
            () => harness.LlmCredentials.SaveAsync(Save(model: "gpt-nonexistent")));
    }

    [Fact]
    public async Task SavingAKeyQueuesTheFirstIndexBuild()
    {
        // A key with no index behind it answers nothing, so the author should not have to
        // find a button to make the feature work.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());

        var job = await harness.Context.RagJobs.AsNoTracking().SingleAsync();

        Assert.Equal(RagJobKind.Index, job.Kind);
        Assert.Equal(RagJobStatus.Queued, job.Status);
    }

    [Fact]
    public async Task DeletingTheKeyCancelsQueuedWorkAndDropsTheIndex()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());

        harness.Context.RagDocuments.Add(new RagDocument
        {
            AuthorId = author.Id,
            SourceType = RagSourceType.Post,
            SourceId = 1,
            SourceLabel = "A post",
            ChunkIndex = 0,
            Content = "Something indexed.",
            ContentHash = new string('a', 64),
            UpdatedAt = harness.TimeProvider.GetUtcNow()
        });
        await harness.Context.SaveChangesAsync();

        await harness.LlmCredentials.DeleteAsync();

        Assert.Empty(await harness.Context.LlmCredentials.ToListAsync());
        Assert.Empty(await harness.Context.RagDocuments.ToListAsync());
        Assert.All(
            await harness.Context.RagJobs.AsNoTracking().ToListAsync(),
            job => Assert.Equal(RagJobStatus.Cancelled, job.Status));
    }

    [Fact]
    public async Task DeletingAKeyThatIsNotThereSucceeds()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.DeleteAsync();
    }

    /* ---------------------------------------------------------------------- */
    /* Turning the public button on                                           */
    /* ---------------------------------------------------------------------- */

    [Fact]
    public async Task AValidatedKeyIsNotEnoughToShowTheButton()
    {
        // Consent is a separate act from supplying a key. A working key lets the owner try
        // the pipeline; it does not put it in front of strangers.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());
        await IndexAsync(harness, author.Id);

        var availability = await harness.JobFit.GetAvailabilityAsync(author.Handle);

        Assert.False(availability.IsEnabled);
    }

    [Fact]
    public async Task TheButtonAppearsOnceTheOwnerTurnsItOn()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());
        await EnableAsync(harness);
        await IndexAsync(harness, author.Id);

        var availability = await harness.JobFit.GetAvailabilityAsync(author.Handle);

        Assert.True(availability.IsEnabled);
        Assert.Equal(LlmCredential.DefaultDailyVisitorLimit, availability.DailyLimit);
    }

    [Fact]
    public async Task AnEmptyIndexKeepsTheButtonDownHoweverTheToggleIsSet()
    {
        // The feature is on and cannot work. Reported as off, rather than inviting somebody
        // to wait forty seconds for an answer grounded in nothing.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());
        await EnableAsync(harness);

        Assert.False((await harness.JobFit.GetAvailabilityAsync(author.Handle)).IsEnabled);
    }

    [Fact]
    public async Task CannotTurnThePublicButtonOnWithAnUnconfirmedKey()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());
        harness.Provider.Reject();
        await harness.LlmCredentials.RevalidateAsync();

        await Assert.ThrowsAsync<ValidationException>(() => EnableAsync(harness));
    }

    [Fact]
    public async Task AHandleNobodyHasLooksExactlyLikeAPortfolioWithTheFeatureOff()
    {
        // Whether somebody holds a provider key is not public, so the two answers must be
        // indistinguishable — otherwise this endpoint enumerates who does.
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;
        await harness.LlmCredentials.SaveAsync(Save());

        var off = await harness.JobFit.GetAvailabilityAsync(author.Handle);
        var absent = await harness.JobFit.GetAvailabilityAsync("nobody-has-this-handle");

        Assert.Equal(absent.IsEnabled, off.IsEnabled);
        Assert.Equal(absent.DailyLimit, off.DailyLimit);
        Assert.Equal(absent.IndexedPassages, off.IndexedPassages);
    }

    /* ---------------------------------------------------------------------- */
    /* Spending somebody else's money                                         */
    /* ---------------------------------------------------------------------- */

    [Fact]
    public async Task QueuesAnAnalysisForAVisitor()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness);

        harness.CurrentUser.AuthorId = null;
        var job = await harness.JobFit.SubmitAsync(author.Handle, Posting());

        var row = await harness.Context.RagJobs
            .AsNoTracking()
            .SingleAsync(j => j.Kind == RagJobKind.JobFit);

        Assert.Equal(job.Id, row.Id);
        Assert.Equal(RagJobStatus.Queued, row.Status);
        Assert.Equal("visitor-one", row.VisitorHash);
    }

    [Fact]
    public async Task RefusesAVisitorPastTheDailyLimit()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness, dailyLimit: 2);

        harness.CurrentUser.AuthorId = null;
        await harness.JobFit.SubmitAsync(author.Handle, Posting());
        await harness.JobFit.SubmitAsync(author.Handle, Posting());

        await Assert.ThrowsAsync<ConflictException>(
            () => harness.JobFit.SubmitAsync(author.Handle, Posting()));
    }

    [Fact]
    public async Task ADifferentVisitorHasTheirOwnAllowance()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness, dailyLimit: 1);

        harness.CurrentUser.AuthorId = null;
        await harness.JobFit.SubmitAsync(author.Handle, Posting());

        harness.Visitors.Value = "visitor-two";
        await harness.JobFit.SubmitAsync(author.Handle, Posting());
    }

    [Fact]
    public async Task RefusesOnceTheAccountsMonthlyCountIsSpent()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness, dailyLimit: 100, monthlyLimit: 2);

        harness.CurrentUser.AuthorId = null;
        await harness.JobFit.SubmitAsync(author.Handle, Posting());
        harness.Visitors.Value = "visitor-two";
        await harness.JobFit.SubmitAsync(author.Handle, Posting());

        harness.Visitors.Value = "visitor-three";
        await Assert.ThrowsAsync<ConflictException>(
            () => harness.JobFit.SubmitAsync(author.Handle, Posting()));
    }

    [Fact]
    public async Task RefusesOnceTheMonthlyBudgetIsSpent()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness, budgetUsd: 1.00m);

        harness.CurrentUser.AuthorId = null;
        var job = await harness.JobFit.SubmitAsync(author.Handle, Posting());

        // Stand in for the worker having run it and billed for it.
        var row = await harness.Context.RagJobs.SingleAsync(j => j.Id == job.Id);
        row.CostUsd = 1.40m;
        row.Status = RagJobStatus.Succeeded;
        await harness.Context.SaveChangesAsync();

        harness.Visitors.Value = "visitor-two";
        await Assert.ThrowsAsync<ConflictException>(
            () => harness.JobFit.SubmitAsync(author.Handle, Posting()));
    }

    [Fact]
    public async Task TheBudgetCountsTokensSpentOnAnswersThatFailed()
    {
        // Tokens burned on a discarded answer are still on the bill. A budget that only
        // counted successes is one a persistently failing job walks straight past.
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness, budgetUsd: 1.00m);

        harness.CurrentUser.AuthorId = null;
        var job = await harness.JobFit.SubmitAsync(author.Handle, Posting());

        var row = await harness.Context.RagJobs.SingleAsync(j => j.Id == job.Id);
        row.CostUsd = 1.10m;
        row.Status = RagJobStatus.Failed;
        await harness.Context.SaveChangesAsync();

        harness.Visitors.Value = "visitor-two";
        await Assert.ThrowsAsync<ConflictException>(
            () => harness.JobFit.SubmitAsync(author.Handle, Posting()));
    }

    [Fact]
    public async Task TheOwnersOwnBudgetAppliesToTheirOwnTrialRuns()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness, budgetUsd: 0.50m);
        harness.CurrentUser.AuthorId = author.Id;

        var job = await harness.LlmCredentials.TryJobFitAsync(Posting());

        var row = await harness.Context.RagJobs.SingleAsync(j => j.Id == job.Id);
        row.CostUsd = 0.60m;
        await harness.Context.SaveChangesAsync();

        await Assert.ThrowsAsync<ConflictException>(
            () => harness.LlmCredentials.TryJobFitAsync(Posting()));
    }

    [Fact]
    public async Task RefusesATooShortPosting()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness);

        harness.CurrentUser.AuthorId = null;

        await Assert.ThrowsAsync<ValidationException>(
            () => harness.JobFit.SubmitAsync(author.Handle, Posting("Backend engineer wanted.")));
    }

    [Fact]
    public async Task RefusesAPostingOverTheLimit()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness);

        harness.CurrentUser.AuthorId = null;

        await Assert.ThrowsAsync<PayloadTooLargeException>(
            () => harness.JobFit.SubmitAsync(
                author.Handle,
                Posting(new string('x', harness.LlmOptions.MaxJobDescriptionChars + 1))));
    }

    [Fact]
    public async Task AnOversizedPostingDoesNotCostTheVisitorATry()
    {
        // Validated before any counting, so a paste that was never going to run is not also
        // one of the few attempts somebody gets.
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness, dailyLimit: 1);

        harness.CurrentUser.AuthorId = null;

        await Assert.ThrowsAsync<PayloadTooLargeException>(
            () => harness.JobFit.SubmitAsync(
                author.Handle,
                Posting(new string('x', harness.LlmOptions.MaxJobDescriptionChars + 1))));

        await harness.JobFit.SubmitAsync(author.Handle, Posting());
    }

    [Fact]
    public async Task RefusesAPortfolioThatHasNotTurnedTheFeatureOn()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;
        await harness.LlmCredentials.SaveAsync(Save());

        harness.CurrentUser.AuthorId = null;

        await Assert.ThrowsAsync<NotFoundException>(
            () => harness.JobFit.SubmitAsync(author.Handle, Posting()));
    }

    /* ---------------------------------------------------------------------- */
    /* Reading a job back                                                     */
    /* ---------------------------------------------------------------------- */

    [Fact]
    public async Task APublicJobCarriesNoCostFigure()
    {
        // What a visitor's curiosity charged somebody else is not theirs to read, and a
        // spend figure on an anonymous endpoint measures another account's traffic.
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness);

        harness.CurrentUser.AuthorId = null;
        var job = await harness.JobFit.SubmitAsync(author.Handle, Posting());

        var row = await harness.Context.RagJobs.SingleAsync(j => j.Id == job.Id);
        row.Status = RagJobStatus.Succeeded;
        row.ResultJson = SucceededReport;
        row.CostUsd = 0.42m;
        await harness.Context.SaveChangesAsync();

        var publicView = await harness.JobFit.GetJobAsync(job.Id);
        Assert.Equal("A clear match on the storage half.", publicView.Report!.Headline);
        Assert.Null(publicView.Report.Usage);

        harness.CurrentUser.AuthorId = author.Id;
        var ownerView = await harness.LlmCredentials.GetOwnJobAsync(job.Id);
        Assert.Equal(0.42m, ownerView.Report!.Usage!.CostUsd);
    }

    [Fact]
    public async Task ReadsTheWorkersJsonIntoTheReport()
    {
        // The contract between the two runtimes: snake_case in, typed DTO out.
        await using var harness = await TestHarness.CreateAsync();
        var author = await ReadyPortfolioAsync(harness);

        harness.CurrentUser.AuthorId = null;
        var job = await harness.JobFit.SubmitAsync(author.Handle, Posting());

        var row = await harness.Context.RagJobs.SingleAsync(j => j.Id == job.Id);
        row.Status = RagJobStatus.Succeeded;
        row.ResultJson = SucceededReport;
        await harness.Context.SaveChangesAsync();

        var report = (await harness.JobFit.GetJobAsync(job.Id)).Report!;

        Assert.Equal(JobFitVerdict.Promising, report.Verdict);
        Assert.Equal(72, report.Score);

        var requirement = Assert.Single(report.Requirements);
        Assert.Equal(RequirementStatus.Met, requirement.Status);
        Assert.True(requirement.IsEssential);

        var evidence = Assert.Single(requirement.Evidence);
        Assert.Equal(RagSourceType.Experience, evidence.SourceType);
        Assert.Equal(9001, evidence.DocumentId);
        Assert.Equal(2, report.Retrieval.CitationsRejected);
    }

    [Fact]
    public async Task ARebuildIsNotAJobAVisitorCanRead()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;
        await harness.LlmCredentials.SaveAsync(Save());

        var rebuild = await harness.Context.RagJobs.AsNoTracking().SingleAsync();

        harness.CurrentUser.AuthorId = null;

        await Assert.ThrowsAsync<NotFoundException>(() => harness.JobFit.GetJobAsync(rebuild.Id));
    }

    [Fact]
    public async Task OneAuthorCannotReadAnothersJob()
    {
        await using var harness = await TestHarness.CreateAsync();
        var owner = await ReadyPortfolioAsync(harness);
        var stranger = await harness.AddAuthorAsync("stranger@example.com");

        harness.CurrentUser.AuthorId = null;
        var job = await harness.JobFit.SubmitAsync(owner.Handle, Posting());

        harness.CurrentUser.AuthorId = stranger.Id;

        await Assert.ThrowsAsync<NotFoundException>(
            () => harness.LlmCredentials.GetOwnJobAsync(job.Id));
    }

    [Fact]
    public async Task ARebuildDoesNotStackBehindOneAlreadyQueued()
    {
        await using var harness = await TestHarness.CreateAsync();
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;
        await harness.LlmCredentials.SaveAsync(Save());

        var first = await harness.LlmCredentials.RebuildIndexAsync();
        var second = await harness.LlmCredentials.RebuildIndexAsync();

        Assert.Equal(first.Id, second.Id);
        Assert.Single(await harness.Context.RagJobs.Where(j => j.Kind == RagJobKind.Index).ToListAsync());
    }

    /* ---------------------------------------------------------------------- */
    /* Helpers                                                                */
    /* ---------------------------------------------------------------------- */

    private static async Task<Author> ReadyPortfolioAsync(
        TestHarness harness,
        int dailyLimit = LlmCredential.DefaultDailyVisitorLimit,
        int monthlyLimit = LlmCredential.DefaultMonthlyAccountLimit,
        decimal budgetUsd = LlmCredential.DefaultMonthlyBudgetUsd)
    {
        var author = await harness.AddAuthorAsync("author@example.com");
        harness.CurrentUser.AuthorId = author.Id;

        await harness.LlmCredentials.SaveAsync(Save());
        await EnableAsync(harness, dailyLimit, monthlyLimit, budgetUsd);
        await IndexAsync(harness, author.Id);

        return author;
    }

    private static Task<LlmCredentialDto> EnableAsync(
        TestHarness harness,
        int dailyLimit = LlmCredential.DefaultDailyVisitorLimit,
        int monthlyLimit = LlmCredential.DefaultMonthlyAccountLimit,
        decimal budgetUsd = LlmCredential.DefaultMonthlyBudgetUsd) =>
        harness.LlmCredentials.UpdateSettingsAsync(new UpdateLlmSettingsDto
        {
            IsPublicFitEnabled = true,
            DailyVisitorLimit = dailyLimit,
            MonthlyAccountLimit = monthlyLimit,
            MonthlyBudgetUsd = budgetUsd
        });

    /// <summary>
    /// Stands in for the worker having indexed the portfolio. The API never writes these
    /// rows, so a test that needs a non-empty index has to put one there.
    /// </summary>
    private static async Task IndexAsync(TestHarness harness, int authorId)
    {
        harness.Context.RagIndexStates.Add(new RagIndexState
        {
            AuthorId = authorId,
            BuiltAt = harness.TimeProvider.GetUtcNow(),
            DocumentCount = 42,
            CorpusHash = new string('b', 64)
        });

        await harness.Context.SaveChangesAsync();
    }

    private const string SucceededReport = """
        {
          "verdict": "promising",
          "score": 72,
          "headline": "A clear match on the storage half.",
          "summary": "Two paragraphs of Markdown.",
          "requirements": [
            {
              "requirement": "Rust in production",
              "is_essential": true,
              "status": "met",
              "confidence": 0.82,
              "rationale": "The write-ahead log rewrite.",
              "evidence": [
                {
                  "document_id": 9001,
                  "source_type": "experience",
                  "source_label": "Helio Data - Staff Engineer",
                  "quote": "Rewrote the write-ahead log in Rust"
                }
              ]
            }
          ],
          "strengths": ["Storage internals"],
          "gaps": ["No mobile work"],
          "talking_points": ["Ask about the repair path"],
          "retrieval": {
            "queries": ["rust production storage"],
            "passages_considered": 24,
            "passages_cited": 7,
            "citations_rejected": 2
          },
          "usage": {
            "provider": "anthropic",
            "model": "claude-opus-5",
            "input_tokens": 18000,
            "output_tokens": 2400,
            "cost_usd": "0.42",
            "duration_ms": 38000
          }
        }
        """;
}
