namespace Backend.Common.Exceptions;

/// <summary>
/// The caller is doing something legitimate too often — asking for another verification
/// code before the last one has had time to arrive, or guessing at one. Separate from
/// <see cref="ValidationException"/> because the request was not malformed: it was early.
/// </summary>
public class TooManyRequestsException : Exception
{
    public TooManyRequestsException(string message) : base(message) { }
}
