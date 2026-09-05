namespace Backend.Common.Exceptions;

public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }

    public static NotFoundException For(string resource, object key) =>
        new($"{resource} '{key}' was not found.");
}
