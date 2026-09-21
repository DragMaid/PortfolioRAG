using Backend.Common.Exceptions;
using Backend.Common.Options;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using MimeKit.Text;

namespace Backend.Services;

/// <summary>
/// Hands messages to the configured relay. A connection per message: the API sends a
/// handful of them a day, and a pooled one would have to survive the relay dropping it
/// while idle for no gain at that rate.
/// </summary>
public class SmtpEmailSender : IEmailSender
{
    private readonly SmtpOptions _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<SmtpOptions> options, ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public bool IsConfigured => _options.IsConfigured;

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured)
        {
            throw new NotConfiguredException(
                "Outgoing mail is not configured, so this message cannot be sent. Fill in the " +
                $"'{SmtpOptions.SectionName}' section.");
        }

        var mime = new MimeMessage();
        mime.From.Add(new MailboxAddress(_options.FromName, _options.FromAddress));
        mime.To.Add(new MailboxAddress(message.ToName ?? string.Empty, message.ToAddress));
        mime.Subject = message.Subject;

        mime.Body = message.HtmlBody is null
            ? new TextPart(TextFormat.Plain) { Text = message.TextBody }
            : new MultipartAlternative
            {
                new TextPart(TextFormat.Plain) { Text = message.TextBody },
                new TextPart(TextFormat.Html) { Text = message.HtmlBody }
            };

        using var client = new SmtpClient
        {
            Timeout = _options.TimeoutSeconds * 1000
        };

        try
        {
            // NOTE: SslOnConnect is port 465, where the socket is TLS immediately;
            // StartTls is 587, where a plaintext connection is upgraded before login.
            // Neither is ever "none" — the password below would cross the wire in the clear.
            var security = _options.UseStartTls
                ? SecureSocketOptions.StartTls
                : SecureSocketOptions.SslOnConnect;

            await client.ConnectAsync(_options.Host, _options.Port, security, cancellationToken);

            if (!string.IsNullOrWhiteSpace(_options.Username))
                await client.AuthenticateAsync(_options.Username, _options.Password, cancellationToken);

            await client.SendAsync(mime, cancellationToken);
        }
        finally
        {
            // NOTE: in the finally so a failed send still closes the connection politely
            // rather than leaving the relay holding it open until it times out.
            if (client.IsConnected)
                await client.DisconnectAsync(true, CancellationToken.None);
        }

        _logger.LogInformation("Sent '{Subject}' to {Address}.", message.Subject, message.ToAddress);
    }
}
