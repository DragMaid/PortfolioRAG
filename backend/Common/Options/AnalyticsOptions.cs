namespace Backend.Common.Options;

public class AnalyticsOptions
{
    public const string SectionName = "Analytics";

    // NOTE: used with IP to hash a annoynomous user identity 
    public string VisitorSalt { get; set; } = "development-visitor-salt";

    // Indicating hosts of owned website to process referal access
    public string[] SelfHosts { get; set; } = Array.Empty<string>();
}
