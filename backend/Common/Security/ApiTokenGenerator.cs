using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace Backend.Common.Security;

/// <summary>Mints and hashes the raw API tokens. Kept beside <see cref="PasswordHasher"/></summary>
public static class ApiTokenGenerator
{
    public const string Prefix = "pfl_";

    private const int SecretBytes = 32;

    /// <summary>How much of the raw token is kept in the clear for the studio to show.</summary>
    private const int PreviewLength = 10;

    /// <summary>Longest a raw token can be, used to throw out junk before hashing it.</summary>
    public const int MaximumTokenLength = 128;

    public static (string RawToken, string TokenHash, string Preview) Create()
    {
        var raw = Prefix + WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(SecretBytes));
        return (raw, Hash(raw), raw[..PreviewLength]);
    }

    /// <summary>True for a string shaped like one of ours. Says nothing about whether it exists.</summary>
    public static bool LooksLikeApiToken(string? value) =>
        value is not null &&
        value.Length is > 8 and <= MaximumTokenLength &&
        value.StartsWith(Prefix, StringComparison.Ordinal);

    public static string Hash(string rawToken) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}
