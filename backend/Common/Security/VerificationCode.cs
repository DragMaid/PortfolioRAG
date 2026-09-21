using System.Security.Cryptography;

namespace Backend.Common.Security;

/// <summary>
/// The digits emailed to confirm an address, and how they are stored. Kept beside
/// <see cref="PasswordHasher"/> and <see cref="ApiTokenGenerator"/> for the same reason:
/// one place decides how a secret of this kind is minted and checked.
/// </summary>
public static class VerificationCode
{
    public const int MinimumLength = 4;

    // NOTE: 9 keeps the whole range inside an int, which is what RandomNumberGenerator
    // hands out. Nobody is going to type more than that anyway.
    public const int MaximumLength = 9;

    /// <summary>A code of <paramref name="length"/> digits, leading zeros included.</summary>
    public static string Create(int length)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(length, MinimumLength);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(length, MaximumLength);

        // NOTE: GetInt32 rather than GetBytes-and-modulo. Folding 256 values onto ten
        // digits leaves the low ones slightly likelier, and the whole point of the code is
        // that guessing it is no better than chance.
        var value = RandomNumberGenerator.GetInt32(0, (int)Math.Pow(10, length));

        return value.ToString(new string('0', length));
    }

    /// <summary>
    /// A million codes is a range somebody with the table could walk in seconds, so the
    /// stored form is the same slow hash a password gets rather than a bare SHA-256. The
    /// row is found by author id, so nothing needs the hash to be deterministic.
    /// </summary>
    public static string Hash(string code) => PasswordHasher.Hash(code);

    public static bool Verify(string code, string hash) => PasswordHasher.Verify(code, hash);

    /// <summary>
    /// Spends the same work a real check costs, so "no code outstanding" and "wrong code"
    /// take the same time.
    /// </summary>
    public static void BurnVerificationTime() => PasswordHasher.BurnVerificationTime();

    /// <summary>True for a string shaped like one of ours: digits, and only digits.</summary>
    public static bool LooksLikeCode(string? value, int length) =>
        value is not null &&
        value.Length == length &&
        value.All(char.IsAsciiDigit);
}
