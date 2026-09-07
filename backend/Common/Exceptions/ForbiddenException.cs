namespace Backend.Common.Exceptions;

/// <summary>
/// The caller is known but is not allowed to touch this resource — reading someone
/// else's draft, or publishing on their behalf.
/// </summary>
public class ForbiddenException : Exception
{
    public ForbiddenException(string message) : base(message) { }

    public static ForbiddenException For(string resource, object key) =>
        new($"You are not allowed to access {resource} '{key}'.");
}
