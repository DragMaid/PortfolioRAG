using Backend.Models.Entities;
using Identity = Microsoft.AspNetCore.Identity;

namespace Backend.Common.Security;

public static class PasswordHasher
{
    /// <summary>Length policy, kept here so the DTO annotations and the hasher agree.</summary>
    public const int MinimumPasswordLength = 12;

    // NOTE: In case of all the maniacs
    public const int MaximumPasswordLength = 128;

    // NOTE: the interface for password hasher reqyures a generic<T> object binded as the
    // the hasher can potentially use information from the object for the hashing process
    // though here we are not doing so (just passing in as a placeholder)
    private static readonly Identity.IPasswordHasher<Author> Hasher = new Identity.PasswordHasher<Author>();

    private static readonly Author Placeholder = new();

    // NOTE: a real hash to verify against when there is no account, so the miss costs the
    // same work as a hit, this is more for UX purposes rather
    private static readonly string DecoyHash = Hasher.HashPassword(Placeholder, "not-a-real-password");

    public static string Hash(string password) => Hasher.HashPassword(Placeholder, password);

    public static bool Verify(string password, string hash) =>
        // NOTE: SuccessRehashNeeded say that the password is correct but the hashing
        // algorithm used was an old version that is no longer used
        Hasher.VerifyHashedPassword(Placeholder, hash, password) is
            Identity.PasswordVerificationResult.Success or
            Identity.PasswordVerificationResult.SuccessRehashNeeded;

    public static void BurnVerificationTime() =>
        Hasher.VerifyHashedPassword(Placeholder, DecoyHash, string.Empty);
}
