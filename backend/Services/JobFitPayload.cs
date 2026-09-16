using System.Text.Json;
using Backend.Common.Exceptions;
using Backend.Mapping;
using Backend.Models.DTOs.Llm;

namespace Backend.Services;

/// <summary>
/// Turns a submitted job description into the JSON the worker reads off the queue.
///
/// Shared by the public endpoint and the studio's own trial run so that the two cannot
/// diverge on what counts as too long or what the worker is handed — the studio's runs are
/// the only rehearsal the public path gets.
/// </summary>
public static class JobFitPayload
{
    /// <summary>
    /// Below this a posting is a fragment, and an analysis of it would be an analysis of
    /// nothing. Mirrors the annotation on <see cref="JobFitRequestDto.JobDescription"/>;
    /// stated here too because the studio path does not go through model binding.
    /// </summary>
    public const int MinimumChars = 120;

    public static string Normalize(JobFitRequestDto dto, int maximumChars) =>
        Serialize(Validate(dto.JobDescription, maximumChars), dto.RoleTitle, dto.Company, notes: null);
    {
        var description = jobDescription?.Trim() ?? string.Empty;

        if (description.Length < MinimumChars)
        {
            throw new ValidationException(
                $"Paste a bit more of the posting — at least {MinimumChars} characters. A few lines is not " +
                "enough to read requirements out of.");
        }

        if (description.Length > maximumChars)
        {
            throw new PayloadTooLargeException(
                $"That posting is {description.Length:N0} characters, over the {maximumChars:N0} limit. " +
                "Paste the requirements and responsibilities rather than the whole page.");
        }

        return description;
    }

    private static string Serialize(string description, string? roleTitle, string? company, string? notes) =>
        JsonSerializer.Serialize(
            new
            {
                job_description = description,
                role_title = Trimmed(roleTitle),
                company = Trimmed(company),
                notes = Trimmed(notes)
            },
            LlmMappingExtensions.WorkerJson);

    private static string? Trimmed(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
