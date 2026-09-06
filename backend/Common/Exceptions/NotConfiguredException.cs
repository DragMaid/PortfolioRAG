namespace Backend.Common.Exceptions;

/// <summary>
/// An optional feature was called but the deployment never supplied its settings —
/// Google sign-in without a client id, for example.
/// </summary>
public class NotConfiguredException : Exception
{
    public NotConfiguredException(string message) : base(message) { }
}
