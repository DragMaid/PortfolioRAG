using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Backend.Common.Options;
using Microsoft.Extensions.Options;

namespace Backend.Common.Security;

/// <summary>
/// A stable-for-a-day, unlinkable-across-days identifier for an anonymous reader.
/// </summary>
public interface IVisitorFingerprint
{
    string Compute(DateTimeOffset now);
}

/// <summary>
/// The salted daily digest of address and user agent behind both the analytics counts and
/// the per-visitor ceiling on the public job-fit endpoint.
/// </summary>
public class VisitorFingerprint : IVisitorFingerprint
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly AnalyticsOptions _options;

    public VisitorFingerprint(
        IHttpContextAccessor httpContextAccessor,
        IOptions<AnalyticsOptions> options)
    {
        _httpContextAccessor = httpContextAccessor;
        _options = options.Value;
    }

    public string Compute(DateTimeOffset now)
    {
        var context = _httpContextAccessor.HttpContext;

        var address = context?.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var userAgent = context?.Request.Headers.UserAgent.ToString() ?? string.Empty;
        var day = now.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        var material = $"{_options.VisitorSalt}|{day}|{address}|{userAgent}";
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(material));

        return Convert.ToHexString(digest);
    }
}
