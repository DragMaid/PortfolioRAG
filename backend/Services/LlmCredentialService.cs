using System.Text.Json;
using Backend.Common.Exceptions;
using Backend.Common.Options;
using Backend.Common.Security;
using Backend.Mapping;
using Backend.Models.DTOs.Llm;
using Backend.Models.Entities;
using Backend.Repositories;
using Microsoft.Extensions.Options;

namespace Backend.Services;

public class LlmCredentialService : ILlmCredentialService
{
    private readonly IRagRepository _rag;
    private readonly ICurrentUser _currentUser;
    private readonly ISecretProtector _protector;
    private readonly ILlmProviderRegistry _providers;
    private readonly TimeProvider _timeProvider;
    private readonly LlmOptions _options;
    private readonly ILogger<LlmCredentialService> _logger;

    public LlmCredentialService(
        IRagRepository rag,
        ICurrentUser currentUser,
        ISecretProtector protector,
        ILlmProviderRegistry providers,
        TimeProvider timeProvider,
        IOptions<LlmOptions> options,
        ILogger<LlmCredentialService> logger)
    {
        _rag = rag;
        _currentUser = currentUser;
        _protector = protector;
        _providers = providers;
        _timeProvider = timeProvider;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<LlmCredentialDto?> GetAsync(CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var credential = await _rag.GetCredentialAsync(authorId, tracked: false, cancellationToken);

        return credential is null
            ? null
            : await DescribeAsync(credential, Array.Empty<string>(), cancellationToken);
    }

    public async Task<LlmCredentialDto> SaveAsync(
        SaveLlmCredentialDto dto,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var now = _timeProvider.GetUtcNow();

        var apiKey = dto.ApiKey.Trim();
        var provider = _providers.For(dto.Provider);

        if (!provider.LooksLikeKey(apiKey))
        {
            throw new ValidationException(
                $"That does not look like a {dto.Provider} API key. Check you pasted the key itself, " +
                "and nothing around it.");
        }

        var validation = await provider.ValidateAsync(apiKey, cancellationToken);

        if (!validation.IsValid)
        {
            // NOTE: nothing is written either way. A rejected key must not replace a working
            // one, and an unreachable provider must not mark a working key broken — both
            // would punish the author for somebody else's failure. The distinction is in the
            // exception type so the controller can answer 400 or 503.
            if (validation.IsProviderFault)
                throw new NotConfiguredException(validation.Error!);

            throw new ValidationException(validation.Error!);
        }

        var model = ChooseModel(dto.Model, provider.DefaultModel, validation.Models);

        var credential = await _rag.GetCredentialAsync(authorId, tracked: true, cancellationToken);

        if (credential is null)
        {
            credential = new LlmCredential { AuthorId = authorId, CreatedAt = now };
            await _rag.AddCredentialAsync(credential, cancellationToken);
        }

        credential.Provider = dto.Provider;
        credential.KeyCiphertext = _protector.Protect(apiKey);
        credential.KeyPreview = Preview(apiKey);
        credential.Model = model;
        credential.ValidatedAt = now;
        credential.ValidationError = null;
        credential.UpdatedAt = now;

        await _rag.SaveChangesAsync(cancellationToken);

        // A key with no index behind it answers nothing, so the first save queues the build
        // rather than leaving the author to find the button.
        await EnqueueIndexAsync(authorId, force: true, now, cancellationToken);

        _logger.LogInformation(
            "Author {AuthorId} stored a {Provider} key ending {Preview}.",
            authorId,
            credential.Provider,
            credential.KeyPreview);

        return await DescribeAsync(credential, validation.Models, cancellationToken);
    }

    public async Task<LlmCredentialDto> RevalidateAsync(CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var credential = await RequireCredentialAsync(authorId, cancellationToken);
        var now = _timeProvider.GetUtcNow();

        var provider = _providers.For(credential.Provider);
        var validation = await provider.ValidateAsync(Unseal(credential), cancellationToken);

        if (validation.IsProviderFault)
        {
            // Unchanged on purpose: this endpoint exists to answer "is my key still good",
            // and "we could not tell" is not an answer that should overwrite yesterday's.
            throw new NotConfiguredException(validation.Error!);
        }

        credential.ValidatedAt = validation.IsValid ? now : null;
        credential.ValidationError = validation.Error;
        credential.UpdatedAt = now;

        await _rag.SaveChangesAsync(cancellationToken);

        return await DescribeAsync(credential, validation.Models, cancellationToken);
    }

    public async Task<LlmCredentialDto> UpdateSettingsAsync(
        UpdateLlmSettingsDto dto,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var credential = await RequireCredentialAsync(authorId, cancellationToken);

        if (dto.IsPublicFitEnabled && !credential.IsUsable)
        {
            throw new ValidationException(
                "The stored key has not been confirmed with the provider, so the public check cannot be " +
                "turned on. Re-check the key first.");
        }

        if (!string.IsNullOrWhiteSpace(dto.Model))
            credential.Model = dto.Model.Trim();

        credential.IsPublicFitEnabled = dto.IsPublicFitEnabled;
        credential.DailyVisitorLimit = dto.DailyVisitorLimit;
        credential.MonthlyAccountLimit = dto.MonthlyAccountLimit;
        credential.MonthlyBudgetUsd = dto.MonthlyBudgetUsd;
        credential.UpdatedAt = _timeProvider.GetUtcNow();

        await _rag.SaveChangesAsync(cancellationToken);

        return await DescribeAsync(credential, Array.Empty<string>(), cancellationToken);
    }

    public async Task DeleteAsync(CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var credential = await _rag.GetCredentialAsync(authorId, tracked: true, cancellationToken);

        // Idempotent: removing a key that is already gone is the state the caller asked for.
        if (credential is null)
            return;

        var now = _timeProvider.GetUtcNow();

        _rag.RemoveCredential(credential);
        await _rag.CancelPendingJobsAsync(authorId, now, cancellationToken);
        await _rag.DeleteDocumentsAsync(authorId, cancellationToken);
        await _rag.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Author {AuthorId} removed their provider key and index.", authorId);
    }

    public async Task<RagJobDto> RebuildIndexAsync(CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        await RequireCredentialAsync(authorId, cancellationToken);

        var job = await EnqueueIndexAsync(
            authorId,
            force: true,
            _timeProvider.GetUtcNow(),
            cancellationToken);

        return job.ToDto(includeUsage: true);
    }

    public async Task<RagJobDto> TryJobFitAsync(
        JobFitRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();
        var credential = await RequireCredentialAsync(authorId, cancellationToken);

        if (!credential.IsUsable)
        {
            throw new ValidationException(
                "The stored key has not been confirmed with the provider. Re-check it before running an analysis.");
        }

        var description = JobFitPayload.Normalize(dto, _options.MaxJobDescriptionChars);
        var now = _timeProvider.GetUtcNow();

        // NOTE: the budget applies here as well as on the public path. An owner testing the
        // feature is spending the same money as a visitor using it, and a ceiling that the
        // account holder can walk past is not a ceiling. The per-visitor daily count is the
        // one thing skipped — it bounds strangers, not the person who set it.
        await EnsureWithinBudgetAsync(credential, now, cancellationToken);

        var job = new RagJob
        {
            Id = Guid.NewGuid(),
            AuthorId = authorId,
            Kind = RagJobKind.JobFit,
            Status = RagJobStatus.Queued,
            PayloadJson = description,
            AvailableAt = now,
            CreatedAt = now,
            VisitorHash = null
        };

        await _rag.AddJobAsync(job, cancellationToken);
        await _rag.SaveChangesAsync(cancellationToken);
        await _rag.NotifyQueueAsync(cancellationToken);

        return job.ToDto(includeUsage: true);
    }

    public async Task<RagJobDto> GetOwnJobAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var authorId = _currentUser.RequireAuthorId();

        var job = await _rag.GetJobAsync(id, cancellationToken);

        // NOTE: one answer for "no such job" and "not yours". The id is a GUID, so a caller
        // who has one either was given it or guessed it, and telling the second kind that
        // they guessed a real one is the only thing that would make guessing worthwhile.
        if (job is null || job.AuthorId != authorId)
            throw NotFoundException.For("Job", id);

        return job.ToDto(includeUsage: true);
    }

    /* ---------------------------------------------------------------------- */
    /* Internals                                                              */
    /* ---------------------------------------------------------------------- */

    private async Task<LlmCredential> RequireCredentialAsync(
        int authorId,
        CancellationToken cancellationToken) =>
        await _rag.GetCredentialAsync(authorId, tracked: true, cancellationToken)
        ?? throw new NotFoundException("No provider key has been added to this account.");

    /// <summary>
    /// Reads the stored key back, turning a key sealed under a retired encryption key into
    /// a message the author can act on rather than a stack trace.
    /// </summary>
    private string Unseal(LlmCredential credential)
    {
        try
        {
            return _protector.Unprotect(credential.KeyCiphertext);
        }
        catch (System.Security.Cryptography.CryptographicException exception)
        {
            _logger.LogError(
                exception,
                "The stored provider key for author {AuthorId} could not be unsealed. The deployment's " +
                "'{SectionName}:EncryptionKey' has probably changed.",
                credential.AuthorId,
                LlmOptions.SectionName);

            throw new ValidationException(
                "The stored key can no longer be read by this deployment. Enter it again.");
        }
    }

    /// <summary>
    /// Queues a rebuild, or hands back the one already queued.
    ///
    /// The worker re-checks freshness itself before every analysis, so this is a
    /// convenience — somewhere to press when an author has just published and wants the
    /// index caught up now — rather than the mechanism keeping the index correct.
    /// </summary>
    private async Task<RagJob> EnqueueIndexAsync(
        int authorId,
        bool force,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var existing = await _rag.GetActiveJobAsync(authorId, RagJobKind.Index, cancellationToken);

        if (existing is not null)
            return existing;

        var job = new RagJob
        {
            Id = Guid.NewGuid(),
            AuthorId = authorId,
            Kind = RagJobKind.Index,
            Status = RagJobStatus.Queued,
            PayloadJson = JsonSerializer.Serialize(new { force }, LlmMappingExtensions.WorkerJson),
            AvailableAt = now,
            CreatedAt = now
        };

        await _rag.AddJobAsync(job, cancellationToken);
        await _rag.SaveChangesAsync(cancellationToken);
        await _rag.NotifyQueueAsync(cancellationToken);

        return job;
    }

    private async Task EnsureWithinBudgetAsync(
        LlmCredential credential,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var monthStart = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var spent = await _rag.SumSpendSinceAsync(credential.AuthorId, monthStart, cancellationToken);

        if (spent >= credential.MonthlyBudgetUsd)
        {
            throw new ConflictException(
                $"This month's budget of ${credential.MonthlyBudgetUsd:0.00} is spent. Raise it, or wait " +
                "for the month to turn over.");
        }
    }

    /// <summary>
    /// Assembles the whole picture the studio screen needs: the credential, the month to
    /// date, the index and whatever rebuild is in flight.
    /// </summary>
    private async Task<LlmCredentialDto> DescribeAsync(
        LlmCredential credential,
        IReadOnlyList<string> availableModels,
        CancellationToken cancellationToken)
    {
        var now = _timeProvider.GetUtcNow();
        var monthStart = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);

        var requests = await _rag.CountAccountJobsSinceAsync(credential.AuthorId, monthStart, cancellationToken);
        var spend = await _rag.SumSpendSinceAsync(credential.AuthorId, monthStart, cancellationToken);
        var index = await _rag.GetIndexStateAsync(credential.AuthorId, tracked: false, cancellationToken);
        var pending = await _rag.GetActiveJobAsync(credential.AuthorId, RagJobKind.Index, cancellationToken);

        return credential.ToDto(availableModels, requests, spend, index, pending);
    }

    /// <summary>
    /// The model to run: what the author asked for, if the provider says the key may use it.
    ///
    /// A model outside the list is refused rather than silently swapped — an author who
    /// typed a model name meant it, and quietly running a different one would show up as a
    /// bill they cannot explain.
    /// </summary>
    private static string ChooseModel(
        string? requested,
        string fallback,
        IReadOnlyList<string> available)
    {
        var model = requested?.Trim();

        if (string.IsNullOrEmpty(model))
            return available.Contains(fallback) || available.Count == 0 ? fallback : available[0];

        if (available.Count > 0 && !available.Contains(model))
        {
            throw new ValidationException(
                $"This key cannot use '{model}'. Available: {string.Join(", ", available.Take(8))}.");
        }

        return model;
    }

    /// <summary>
    /// "sk-ant-…4f2a". Both ends, because a key is recognised by its tail and placed by its
    /// head, and neither alone tells you which of two keys from the same account this is.
    /// </summary>
    private static string Preview(string apiKey)
    {
        const int HeadLength = 7;
        const int TailLength = 4;

        if (apiKey.Length <= HeadLength + TailLength)
            return new string('•', apiKey.Length);

        return $"{apiKey[..HeadLength]}…{apiKey[^TailLength..]}";
    }
}
