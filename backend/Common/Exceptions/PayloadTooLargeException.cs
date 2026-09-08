namespace Backend.Common.Exceptions;

/// <summary>
/// The request body was well formed but bigger than the endpoint is willing to store.
/// </summary>
public class PayloadTooLargeException : Exception
{
    public PayloadTooLargeException(string message) : base(message) { }

    public static PayloadTooLargeException For(string what, long actualBytes, long limitBytes) =>
        new($"The {what} is {actualBytes / 1024d / 1024d:0.##} MB, over the {limitBytes / 1024d / 1024d:0.##} MB limit.");
}
