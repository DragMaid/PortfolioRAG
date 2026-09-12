using System.Security.Cryptography;
using System.Text;
using Backend.Common.Options;
using Microsoft.Extensions.Options;

namespace Backend.Common.Security;

/// <summary>
/// Seals and unseals the provider keys authors hand over.
/// </summary>
public interface ISecretProtector
{
    /// <summary>Seals a secret. The result is safe to store and differs every call.</summary>
    string Protect(string plaintext);

    /// <summary>
    /// Unseals one. Throws <see cref="CryptographicException"/> if the ciphertext was
    /// tampered with or was sealed under a different key.
    /// </summary>
    string Unprotect(string ciphertext);
}

/// <summary>
/// AES-256-GCM over a deployment-wide key.
///
/// Authenticated encryption rather than plain AES because the thing being protected is a
/// credential we will present to somebody else: a ciphertext an attacker with database
/// access could flip bits in is one they could steer, and GCM's tag makes that a failed
/// decryption instead.
/// </summary>
public sealed class SecretProtector : ISecretProtector
{
    // Standard GCM sizes. 96-bit nonces are what the mode is specified around — a longer
    // one is hashed down internally and buys nothing.
    private const int NonceBytes = 12;
    private const int TagBytes = 16;

    private readonly byte[] _key;

    public SecretProtector(IOptions<LlmOptions> options)
    {
        if (!LlmOptions.TryDecodeKey(options.Value.EncryptionKey, out var key))
        {
            throw new InvalidOperationException(
                $"'{LlmOptions.SectionName}:EncryptionKey' is not {LlmOptions.EncryptionKeyBytes} " +
                "base64-encoded bytes. Generate one with: openssl rand -base64 32");
        }

        _key = key;
    }

    public string Protect(string plaintext)
    {
        ArgumentException.ThrowIfNullOrEmpty(plaintext);

        var plainBytes = Encoding.UTF8.GetBytes(plaintext);

        // One buffer, laid out nonce | tag | ciphertext, so a stored secret is a single
        // string with nothing to keep in step beside it.
        var sealed_ = new byte[NonceBytes + TagBytes + plainBytes.Length];
        var nonce = sealed_.AsSpan(0, NonceBytes);
        var tag = sealed_.AsSpan(NonceBytes, TagBytes);
        var cipher = sealed_.AsSpan(NonceBytes + TagBytes);

        RandomNumberGenerator.Fill(nonce);
        using var aes = new AesGcm(_key, TagBytes);
        aes.Encrypt(nonce, plainBytes, cipher, tag);

        return Convert.ToBase64String(sealed_);
    }

    public string Unprotect(string ciphertext)
    {
        ArgumentException.ThrowIfNullOrEmpty(ciphertext);

        byte[] sealed_;

        try
        {
            sealed_ = Convert.FromBase64String(ciphertext);
        }
        catch (FormatException exception)
        {
            throw new CryptographicException("The stored secret is not valid base64.", exception);
        }

        if (sealed_.Length < NonceBytes + TagBytes)
            throw new CryptographicException("The stored secret is too short to be a sealed value.");

        var nonce = sealed_.AsSpan(0, NonceBytes);
        var tag = sealed_.AsSpan(NonceBytes, TagBytes);
        var cipher = sealed_.AsSpan(NonceBytes + TagBytes);
        var plain = new byte[cipher.Length];

        using var aes = new AesGcm(_key, TagBytes);

        // Throws rather than returning garbage when the tag does not match, which is the
        // whole reason for using an authenticated mode.
        aes.Decrypt(nonce, cipher, tag, plain);

        return Encoding.UTF8.GetString(plain);
    }
}
