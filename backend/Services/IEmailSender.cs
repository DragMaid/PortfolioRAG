namespace Backend.Services;

/// <summary>One message, already rendered. The sender decides nothing about its content.</summary>
public sealed record EmailMessage(
    string ToAddress,
    string? ToName,
    string Subject,
    string TextBody,
    string? HtmlBody = null);

/// <summary>
/// Outgoing mail. One implementation talks to an SMTP relay; the other writes the message
/// to the log, which is what a deployment with no relay configured gets — see Program.cs.
/// </summary>
public interface IEmailSender
{
    /// <summary>True when mail actually leaves the process.</summary>
    bool IsConfigured { get; }

    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
