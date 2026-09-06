namespace Backend.Common.Exceptions;

/// <summary>
/// The caller could not be identified: bad credentials, or a refresh token that is
/// expired, revoked or replayed.
/// </summary>
public class UnauthorizedException : Exception
{
    public UnauthorizedException(string message) : base(message) { }
}
