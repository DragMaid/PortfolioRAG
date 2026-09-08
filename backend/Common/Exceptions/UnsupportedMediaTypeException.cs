namespace Backend.Common.Exceptions;

/// <summary>
/// The uploaded bytes are not one of the formats a post may embed. Raised from what the
/// content actually is, never from what the client claimed it was.
/// </summary>
public class UnsupportedMediaTypeException : Exception
{
    public UnsupportedMediaTypeException(string message) : base(message) { }
}
