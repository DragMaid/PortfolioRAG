using Backend.Models.DTOs.Llm;

namespace Backend.Services;

/// <summary>Whether a portfolio offers the job-fit check, and on what terms.</summary>
public class JobFitAvailabilityDto
{
    /// <summary>
    /// True when the owner has a working key and has chosen to show the button. The only
    /// field a client needs; the rest is copy for the form.
    /// </summary>
    public bool IsEnabled { get; init; }

    /// <summary>How many analyses one visitor may run today.</summary>
    public int DailyLimit { get; init; }

    /// <summary>How many of those this visitor has left. Zero renders the form disabled.</summary>
    public int RemainingToday { get; init; }

    /// <summary>The longest posting the endpoint will take, so the form can say so.</summary>
    public int MaxJobDescriptionChars { get; init; }

    /// <summary>
    /// How many passages of the portfolio are indexed. Zero means the answer would have
    /// nothing to stand on, and the button stays down whatever the toggle says.
    /// </summary>
    public int IndexedPassages { get; init; }
}

/// <summary>
/// The public side: a visitor pasting a job description at somebody else's portfolio.
///
/// Anonymous, and spending the owner's money, which makes this the one service in the API
/// where every method starts by deciding whether it is allowed to cost anything.
/// </summary>
public interface IJobFitService
{
    Task<JobFitAvailabilityDto> GetAvailabilityAsync(
        string handle,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Queues an analysis against the portfolio at <paramref name="handle"/>. Returns the
    /// job to poll, never the answer: the pipeline takes tens of seconds and an HTTP
    /// request held open that long is one a proxy will close.
    /// </summary>
    Task<RagJobDto> SubmitAsync(
        string handle,
        JobFitRequestDto dto,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// One job by its id. Public: the id is an unguessable GUID, and holding it is what
    /// stands in for a session that anonymous callers do not have.
    /// </summary>
    Task<RagJobDto> GetJobAsync(Guid id, CancellationToken cancellationToken = default);
}
