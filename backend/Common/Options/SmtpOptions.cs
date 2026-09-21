namespace Backend.Common.Options;

/// <summary>
/// Where outgoing mail goes. Optional: a deployment that leaves it empty logs the
/// verification codes instead of sending them, the same way an unconfigured bucket leaves
/// media disabled rather than failing the whole API at boot.
/// </summary>
public class SmtpOptions
{
    public const string SectionName = "Smtp";

    public string Host { get; set; } = string.Empty;

    public int Port { get; set; } = 587;

    public string Username { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// STARTTLS on the submission port, which is what 587 expects. Set false only for
    /// port 465, where the socket is TLS from the first byte and upgrading it is an error.
    /// </summary>
    public bool UseStartTls { get; set; } = true;

    /// <summary>The envelope sender. Has to be an address the provider lets you send as.</summary>
    public string FromAddress { get; set; } = string.Empty;

    public string FromName { get; set; } = "Portfolio";

    public int TimeoutSeconds { get; set; } = 15;

    /// <summary>
    /// Enough to attempt a send. Username and password are not part of it: a relay on the
    /// same host, or one that authorizes by address, needs neither.
    /// </summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(FromAddress);

    /// <summary>Throws when the section is filled in but cannot produce a usable connection.</summary>
    public void Validate()
    {
        if (!IsConfigured)
            return;

        if (Port is <= 0 or > 65535)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:Port' must be a valid port number.");
        }

        if (TimeoutSeconds <= 0)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:TimeoutSeconds' must be positive.");
        }

        // NOTE: a password with no username is a copy-and-paste accident rather than a
        // relay that authorizes by address, and it would authenticate as nobody.
        if (string.IsNullOrWhiteSpace(Username) != string.IsNullOrWhiteSpace(Password))
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:Username' and '{SectionName}:Password' must be " +
                "supplied together, or both left empty for a relay that needs no credentials.");
        }
    }
}
