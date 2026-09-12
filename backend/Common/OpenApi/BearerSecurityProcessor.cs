using Backend.Common.Security;
using Microsoft.AspNetCore.Authorization;
using NSwag;
using NSwag.Generation.AspNetCore;
using NSwag.Generation.Processors;
using NSwag.Generation.Processors.Contexts;

namespace Backend.Common.OpenApi;

/// <summary>
/// Marks only the operations that actually require a token, by reading the same
/// [Authorize]/[AllowAnonymous] metadata the authorization middleware uses. NSwag's stock
/// OperationSecurityScopeProcessor tags every operation, which would tell a client that
/// signing in needs a token.
/// </summary>
public class BearerSecurityProcessor : IOperationProcessor
{
    private readonly string _schemeName;

    // NOTE: schemeName can be something like "Bearer"
    public BearerSecurityProcessor(string schemeName)
    {
        _schemeName = schemeName;
    }

    // NOTE: this is called once for each of the API operations
    public bool Process(OperationProcessorContext context)
    {
        // Only proceed if this is a ASP.NET core operation
        if (context is not AspNetCoreOperationProcessorContext aspNetCoreContext)
            return true;

        // This extract the metadata annotation on top of the route
        // Example: [Authorize] would result in the Authorize metadata which implement the IAuthorizeData
        var metadata = aspNetCoreContext.ApiDescription.ActionDescriptor.EndpointMetadata;

        // NOTE: controller-level metadata comes before action-level, so walking in order
        // and keeping the last word gives the same answer the middleware reaches.
        var requiresToken = false;

        // Checking if the metadata define whether requiresToken should be used
        // The reason why we are doing this iteratively is so that inner layers are
        // able to override the outer ones
        foreach (var item in metadata)
        {
            if (item is IAllowAnonymous)
                requiresToken = false;
            else if (item is IAuthorizeData)
                requiresToken = true;
        }

        if (!requiresToken)
            return true;

        if (metadata.Any(item => item is SessionOnlyAttribute))
        {
            context.OperationDescription.Operation.Description =
                (context.OperationDescription.Operation.Description + " ").TrimStart() +
                "Requires a signed-in session: an API token is refused here.";
        }

        // Initaliz it with an empty List if currently null
        context.OperationDescription.Operation.Security ??= [];
        context.OperationDescription.Operation.Security.Add(
            new OpenApiSecurityRequirement { [_schemeName] = Array.Empty<string>() });

        return true;
    }
}
