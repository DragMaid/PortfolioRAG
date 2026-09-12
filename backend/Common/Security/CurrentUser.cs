using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Backend.Common.Exceptions;
using Backend.Models.Entities;

namespace Backend.Common.Security;

public class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUser(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    // NOTE: claims principal is an abstraction layer for the overall authenticantication implementation
    // If it was like before, we would have predefined the scheme for the jwt token and reference the sub
    // directly via its attribute, but since the authentication can come from other sources like windows,
    // openid connect, etc, this generic principal conversion make the below appropriate for most methods
    private ClaimsPrincipal? Principal => _httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => AuthorId is not null;

    // NOTE: inbound claim mapping is switched off in Program.cs, so "sub" arrives as "sub".
    public int? AuthorId
    {
        get
        {
            // NOTE: getting the jwt sub or if not of that specific type then use generic NameIdentifier
            var value = Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub)
                ?? Principal?.FindFirstValue(ClaimTypes.NameIdentifier);

            // NOTE: there's an overloaded impl of this method
            // NumberStyles.Interger: allow interger methods can have trailing backspace (ex: "+123 ")
            // CultureInfo.InvariantCulture: allow decimal separator to be either "." or "," 
            // out var id: since TryParse return list<bool, int> so the int needs to be taken up by a var id
            // also making sure that parsed id > 0 if not we'll just set it to null
            return int.TryParse(
                value,
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var id) && id > 0 ? id : null;
        }
    }

    public string? Email =>
        Principal?.FindFirstValue(JwtRegisteredClaimNames.Email) ?? Principal?.FindFirstValue(ClaimTypes.Email);

    // NOTE: the absence of the claim means a session. Only ApiTokenAuthenticationHandler
    // mints it, and a JWT that arrived carrying one would have had to be signed by us.
    public bool IsApiToken =>
        string.Equals(
            Principal?.FindFirstValue(AuthClaims.AuthMethod),
            AuthMethods.ApiToken,
            StringComparison.Ordinal);

    public ApiTokenScope? ApiTokenScope =>
        Enum.TryParse<ApiTokenScope>(Principal?.FindFirstValue(AuthClaims.ApiTokenScope), out var scope)
            ? scope
            : null;

    public int RequireAuthorId() =>
        AuthorId ?? throw new UnauthorizedException("The request is not associated with a signed-in author.");
}
