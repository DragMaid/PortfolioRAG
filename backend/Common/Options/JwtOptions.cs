namespace Backend.Common.Options;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    // NOTE: HS256 wants at least 256 bits of key, so anything under 32 chars is rejected
    // at startup rather than blowing up on the first login.
    public const int MinimumKeyLength = 32;

    public string Issuer { get; set; } = "portfolio-backend";

    public string Audience { get; set; } = "portfolio-frontend";

    public string Key { get; set; } = string.Empty;

    public int AccessTokenMinutes { get; set; } = 15;

    public int RefreshTokenDays { get; set; } = 14;

    /// <summary>Throws when the configuration cannot produce usable tokens.</summary>
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Key) || Key.Length < MinimumKeyLength)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:Key' is missing or shorter than {MinimumKeyLength} characters. " +
                "Set it through user secrets or the environment (Jwt__Key) before starting the API.");
        }

        if (string.IsNullOrWhiteSpace(Issuer) || string.IsNullOrWhiteSpace(Audience))
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:Issuer' and '{SectionName}:Audience' are both required.");
        }

        if (AccessTokenMinutes <= 0 || RefreshTokenDays <= 0)
        {
            throw new InvalidOperationException(
                $"Configuration '{SectionName}:AccessTokenMinutes' and '{SectionName}:RefreshTokenDays' must be positive.");
        }
    }
}
