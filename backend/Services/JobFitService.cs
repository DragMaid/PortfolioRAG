using Backend.Common.Exceptions;
using Backend.Common.Options;
using Backend.Common.Security;
using Backend.Mapping;
using Backend.Models.DTOs.Llm;
using Backend.Models.Entities;
using Backend.Repositories;
using Microsoft.Extensions.Options;

namespace Backend.Services;

public class JobFitService : IJobFitService
{
    private readonly IRagRepository _rag;
    private readonly IAuthorRepository _authors;
    private readonly IVisitorFingerprint _visitors;
    private readonly TimeProvider _timeProvider;
    private readonly LlmOptions _options;
    private readonly ILogger<JobFitService> _logger;

    public JobFitService(
        IRagRepository rag,
        IAuthorRepository authors,
        IVisitorFingerprint visitors,
        TimeProvider timeProvider,
        IOptions<LlmOptions> options,
        ILogger<JobFitService> logger)
    {
        _rag = rag;
        _authors = authors;
        _visitors = visitors;
        _timeProvider = timeProvider;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<JobFitAvailabilityDto> GetAvailabilityAsync(
        string handle,
        CancellationToken cancellationToken = default)
    {
        var author = await FindAuthorAsync(handle, cancellationToken);
        var now = _timeProvider.GetUtcNow();

        // NOTE: Just return unavailable. If it were me, I would spam this
        // endpoint for a bunch of authors to see who has the feature enabled
        if (author is null)
            return Unavailable();

        var credential = await _rag.GetCredentialAsync(author.Id, tracked: false, cancellationToken);

        if (credential is null || !credential.IsUsable || !credential.IsPublicFitEnabled)
            return Unavailable();

        var index = await _rag.GetIndexStateAsync(author.Id, tracked: false, cancellationToken);
        var indexed = index?.DocumentCount ?? 0;

        var used = await _rag.CountVisitorJobsSinceAsync(
            _visitors.Compute(now),
            StartOfDay(now),
            cancellationToken);

        return new JobFitAvailabilityDto
        {
            // NOTE: if there's no index of the author page yet, rag would be
            // meaningless here, so rather just return cannot here
            IsEnabled = indexed > 0,
            DailyLimit = credential.DailyVisitorLimit,
            RemainingToday = Math.Max(0, credential.DailyVisitorLimit - used),
            MaxJobDescriptionChars = _options.MaxJobDescriptionChars,
            IndexedPassages = indexed
        };
    }

    public async Task<RagJobDto> SubmitAsync(
        string handle,
        JobFitRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var author = await FindAuthorAsync(handle, cancellationToken)
            ?? throw NotFoundException.For("Portfolio", handle);

        var credential = await _rag.GetCredentialAsync(author.Id, tracked: false, cancellationToken);

        if (credential is null || !credential.IsUsable || !credential.IsPublicFitEnabled)
            throw NotFoundException.For("Portfolio", handle);

        // Validated before any of the counting below, so an oversized paste is refused as
        // an oversized paste rather than silently consuming one of the visitor's few tries.
        var payload = JobFitPayload.Normalize(dto, _options.MaxJobDescriptionChars);

        var now = _timeProvider.GetUtcNow();
        var visitorHash = _visitors.Compute(now);

        await EnsureVisitorAllowanceAsync(credential, visitorHash, now, cancellationToken);
        await EnsureAccountAllowanceAsync(credential, now, cancellationToken);

        var job = new RagJob
        {
            Id = Guid.NewGuid(),
            AuthorId = author.Id,
            Kind = RagJobKind.JobFit,
            Status = RagJobStatus.Queued,
            PayloadJson = payload,
            AvailableAt = now,
            CreatedAt = now,
            VisitorHash = visitorHash
        };

        await _rag.AddJobAsync(job, cancellationToken);
        await _rag.SaveChangesAsync(cancellationToken);
        await _rag.NotifyQueueAsync(cancellationToken);

        _logger.LogInformation(
            "Queued a public job-fit analysis {JobId} against author {AuthorId}.",
            job.Id,
            author.Id);

        return job.ToDto(includeUsage: false);
    }

    public async Task<RagJobDto> GetJobAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var job = await _rag.GetJobAsync(id, cancellationToken)
            ?? throw NotFoundException.For("Analysis", id);

        if (job.Kind != RagJobKind.JobFit)
            throw NotFoundException.For("Analysis", id);

        return job.ToDto(includeUsage: false);
    }

    /* ---------------------------------------------------------------------- */
    /* Allowances                                                             */
    /* ---------------------------------------------------------------------- */

    /// <summary>Making sure this mf aint DDOS-ing my service.</summary>
    private async Task EnsureVisitorAllowanceAsync(
        LlmCredential credential,
        string visitorHash,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var used = await _rag.CountVisitorJobsSinceAsync(visitorHash, StartOfDay(now), cancellationToken);

        if (used >= credential.DailyVisitorLimit)
        {
            throw new ConflictException(
                $"You have run {used} analyses against this portfolio today, which is the limit its owner " +
                "set. Try again tomorrow.");
        }
    }

    /// <summary>Making sure the user aint spending all his savings on this thing.</summary>
    private async Task EnsureAccountAllowanceAsync(
        LlmCredential credential,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var monthStart = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);

        var served = await _rag.CountAccountJobsSinceAsync(credential.AuthorId, monthStart, cancellationToken);

        if (served >= credential.MonthlyAccountLimit)
        {
            throw new ConflictException(
                "This portfolio has served as many analyses as it will this month. Try again after the " +
                "month turns over.");
        }

        var spent = await _rag.SumSpendSinceAsync(credential.AuthorId, monthStart, cancellationToken);

        if (spent >= credential.MonthlyBudgetUsd)
        {
            throw new ConflictException(
                "This portfolio's analysis budget for the month is spent. Try again after the month turns over.");
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Internals                                                              */
    /* ---------------------------------------------------------------------- */

    private async Task<Author?> FindAuthorAsync(string handle, CancellationToken cancellationToken)
    {
        var normalized = handle?.Trim().ToLowerInvariant();

        return string.IsNullOrEmpty(normalized)
            ? null
            : await _authors.GetByHandleAsync(normalized, tracked: false, cancellationToken);
    }

    /// <summary>
    /// UTC midnight. The visitor hash already rotates on this boundary, so the daily
    /// allowance is a calendar day rather than a rolling window — this only narrows the
    /// count enough for the index to be used.
    /// </summary>
    private static DateTimeOffset StartOfDay(DateTimeOffset now) =>
        new(now.UtcDateTime.Date, TimeSpan.Zero);

    private JobFitAvailabilityDto Unavailable() => new()
    {
        IsEnabled = false,
        DailyLimit = 0,
        RemainingToday = 0,
        MaxJobDescriptionChars = _options.MaxJobDescriptionChars,
        IndexedPassages = 0
    };
}
