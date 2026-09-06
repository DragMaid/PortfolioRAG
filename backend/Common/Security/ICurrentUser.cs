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

    /// <summary>The caller's author id, or a 401 if the request carried no usable identity.</summary>
    int RequireAuthorId();
}
