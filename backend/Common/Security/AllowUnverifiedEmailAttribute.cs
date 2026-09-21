namespace Backend.Common.Security;

/// <summary>
/// Marks an endpoint an account may call before its address is confirmed. Enforced by
/// <see cref="EmailVerificationMiddleware"/>, which reads it off the endpoint metadata the
/// same way <see cref="ApiTokenRestrictionMiddleware"/> reads
/// <see cref="SessionOnlyAttribute"/>.
/// </summary>
/// <remarks>
/// It belongs on the few endpoints a stuck account needs to get unstuck — confirming the
/// address, asking for another code, linking a provider that vouches for it, and setting a
/// password. Everything else that writes can wait until the code has been typed.
/// </remarks>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AllowUnverifiedEmailAttribute : Attribute
{
}
