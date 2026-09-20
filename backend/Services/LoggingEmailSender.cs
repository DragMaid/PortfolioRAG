namespace Backend.Services;

/// <summary>
/// The stand-in for a deployment with no relay configured — development, and the test
/// suite. The message goes to the log, so a verification code can still be read and used;
/// Program.cs warns at boot that this is what is happening.
/// </summary>
public class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger)
    {
        _logger = logger;
    }

    public bool IsConfigured => false;

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "Outgoing mail is not configured; the message below was not sent.\n" +
            "To: {Address}\nSubject: {Subject}\n\n{Body}",
            message.ToAddress,
            message.Subject,
            message.TextBody);

        return Task.CompletedTask;
    }
}
