using Backend.Models.Entities;

namespace Backend.Common.Security;

/// <summary>
/// The authenticated caller, read off the access token. Services depend on this rather
/// than on HttpContext so ownership rules stay testable.
/// </summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    int? AuthorId { get; }

    string? Email { get; }

    /// <summary>
    /// True when the request arrived on an API token rather than a studio session. What
    /// the token restrictions key off — see <see cref="SessionOnlyAttribute"/>.
    /// </summary>
    bool IsApiToken { get; }

    /// <summary>The scope of that token, or null when this is not a token request.</summary>
    ApiTokenScope? ApiTokenScope { get; }

    /// <summary>The caller's author id, or a 401 if the request carried no usable identity.</summary>
    int RequireAuthorId();
}
