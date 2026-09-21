using Backend.Common.Exceptions;

namespace Backend.Common.Security;

/// <summary>
/// Keeps an account that has not confirmed its address from writing anything.
/// </summary>
/// <remarks>
/// Registration still hands back a session, because the client has to be signed in to
/// submit the code at all and bouncing somebody to a sign-in form for an account they
/// created ten seconds ago helps nobody. What the unconfirmed session cannot do is
/// publish: an address nobody has proved is one somebody else may be about to prove, and
/// posts written in the meantime would already be sitting at a handle under their name.
/// Reading is left alone — there is nothing to protect in the account's own empty studio.
/// </remarks>
public class EmailVerificationMiddleware
{
    private static readonly string[] SafeMethods =
        [HttpMethods.Get, HttpMethods.Head, HttpMethods.Options];

    private readonly RequestDelegate _next;

    public EmailVerificationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public Task InvokeAsync(HttpContext context, ICurrentUser currentUser)
    {
        // _next call the next middleware in the pipeline
        if (!currentUser.IsAuthenticated || currentUser.IsEmailConfirmed)
            return _next(context);

        if (IsSafe(context.Request.Method))
            return _next(context);

        if (context.GetEndpoint()?.Metadata.GetMetadata<AllowUnverifiedEmailAttribute>() is not null)
            return _next(context);

        throw new ForbiddenException(
            "Confirm your email address before making changes. We sent a code to the address " +
            "on this account — enter it in the studio, or ask for a new one.");
    }

    private static bool IsSafe(string method) =>
        SafeMethods.Contains(method, StringComparer.OrdinalIgnoreCase);
}
