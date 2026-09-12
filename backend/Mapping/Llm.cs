using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Models.DTOs.Llm;
using Backend.Models.Entities;

namespace Backend.Mapping;

/// <summary>
/// Mapping for the retrieval side. Coverting from the returned 
/// JSON response from python to C# object
/// </summary>
public static class LlmMappingExtensions
{
    public static readonly JsonSerializerOptions WorkerJson = new()
    {
        // Use snake case for both side (python & C#)
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    /// TODO: I doubt this would work though
    /// <summary>Roughly how long a rebuild takes, for a progress bar that means something.</summary>
    private const int IndexEstimateSeconds = 25;

    /// <summary>And an analysis, which is dominated by one long generation.</summary>
    private const int JobFitEstimateSeconds = 45;

    public static LlmCredentialDto ToDto(
        this LlmCredential credential,
        IReadOnlyList<string> availableModels,
        int monthlyRequestCount,
        decimal monthlySpendUsd,
        RagIndexState? index,
        RagJob? pendingIndexJob) => new()
    {
        Provider = credential.Provider,
        KeyPreview = credential.KeyPreview,
        Model = credential.Model,
        ValidatedAt = credential.ValidatedAt,
        ValidationError = credential.ValidationError,
        IsUsable = credential.IsUsable,
        IsPublicFitEnabled = credential.IsPublicFitEnabled,
        DailyVisitorLimit = credential.DailyVisitorLimit,
        MonthlyAccountLimit = credential.MonthlyAccountLimit,
        MonthlyBudgetUsd = credential.MonthlyBudgetUsd,
        MonthlyRequestCount = monthlyRequestCount,
        MonthlySpendUsd = monthlySpendUsd,
        UpdatedAt = credential.UpdatedAt,
        AvailableModels = availableModels,
        Index = new RagIndexStateDto
        {
            BuiltAt = index?.BuiltAt,
            DocumentCount = index?.DocumentCount ?? 0,
            Error = index?.Error,
            PendingJob = pendingIndexJob?.ToDto(includeUsage: true)
        }
    };

    /// <summary>
    /// One job as a caller sees it.
    /// </summary>
    /// <param name="includeUsage">
    /// Whether the report keeps what it cost. False on the public path: a visitor has no
    /// business knowing what their curiosity charged somebody else, and a spend figure on
    /// an anonymous endpoint is a way to measure another account's traffic.
    /// </param>
    public static RagJobDto ToDto(this RagJob job, bool includeUsage) => new()
    {
        Id = job.Id,
        Kind = job.Kind,
        Status = job.Status,
        CreatedAt = job.CreatedAt,
        CompletedAt = job.CompletedAt,
        Error = job.Status == RagJobStatus.Failed ? job.Error : null,
        EstimatedSeconds = job.Kind == RagJobKind.Index ? IndexEstimateSeconds : JobFitEstimateSeconds,
        Report = ReadReport(job, includeUsage)
    };

    /// <summary>The report out of a finished job, or null if there is not one to read.</summary>
    private static JobFitReportDto? ReadReport(RagJob job, bool includeUsage)
    {
        if (job.Status != RagJobStatus.Succeeded || string.IsNullOrWhiteSpace(job.ResultJson))
            return null;

        JobFitReportDto? report;

        try
        {
            report = JsonSerializer.Deserialize<JobFitReportDto>(job.ResultJson, WorkerJson);
        }
        catch (JsonException)
        {
            return null;
        }

        if (report is null)
            return null;

        if (includeUsage)
            return report;

        // DTOs are init only, so have to re-create it here 
        return new JobFitReportDto
        {
            Verdict = report.Verdict,
            Score = report.Score,
            Headline = report.Headline,
            Summary = report.Summary,
            Requirements = report.Requirements,
            Strengths = report.Strengths,
            Gaps = report.Gaps,
            TalkingPoints = report.TalkingPoints,
            Retrieval = report.Retrieval,
            Usage = null
        };
    }
}
