namespace Backend.Common.Security;

/// <summary>The authentication schemes the API accepts, and how a request picks one.</summary>
public static class AuthSchemes
{
    /// <summary>
    /// The default scheme: a policy scheme that reads the Authorization header and forwards
    /// to one of the two below. Registered as the default so <c>[Authorize]</c> keeps
    /// meaning "any credential this API accepts".
    /// </summary>
    public const string Default = "Default";

    /// <summary>A studio session — the JWT access token issued by POST /api/auth/login.</summary>
    public const string Session = "Bearer";

    /// <summary>A long-lived token an author issued for a script or a CI job.</summary>
    public const string ApiToken = "ApiToken";
}

/// <summary>
/// Claims this API mints on top of the registered ones, so an authorization rule can ask
/// how the caller authenticated rather than only who they are.
/// </summary>
public static class AuthClaims
{
    /// <summary>Either <see cref="AuthMethods.Session"/> or <see cref="AuthMethods.ApiToken"/>.</summary>
    public const string AuthMethod = "auth_method";

    /// <summary>The scope of the API token the request came in on.</summary>
    public const string ApiTokenScope = "api_token_scope";

    /// <summary>Which token it was, for the audit trail in the logs.</summary>
    public const string ApiTokenId = "api_token_id";
}

public static class AuthMethods
{
    public const string Session = "session";

    public const string ApiToken = "api_token";
}
