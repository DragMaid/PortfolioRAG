namespace Backend.Common.Security;

/// <summary>
/// Marks an endpoint an API token may not call, however wide its scope. Enforced by
/// <see cref="ApiTokenRestrictionMiddleware"/>, which reads it off the endpoint metadata.
/// </summary>
// NOTE: the line below define where this attribute can apply to (class and method)
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class SessionOnlyAttribute : Attribute
{
}
