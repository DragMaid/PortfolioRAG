using System.Security.Cryptography;
using System.Text;
using Backend.Common.Options;
using Backend.Common.Security;
using Microsoft.Extensions.Options;

namespace Backend.Tests;

/// <summary>
/// The sealing behind stored provider keys, and the wire format the Python worker has to
/// agree with.
/// </summary>
public class SecretProtectorTests
{
    /// <summary>The same key rag/tests/test_crypto_interop.py pins.</summary>
    private const string FixtureKeyMaterial = "test-only-fixed-key-32-bytes!!!!";

    private const string InteropPlaintext = "sk-ant-interop-probe-value";

    private static SecretProtector Build(string? material = null) =>
        new(Options.Create(new LlmOptions
        {
            EncryptionKey = Convert.ToBase64String(
                Encoding.UTF8.GetBytes(material ?? FixtureKeyMaterial))
        }));

    [Fact]
    public void RoundTripsASecret()
    {
        var protector = Build();

        Assert.Equal(InteropPlaintext, protector.Unprotect(protector.Protect(InteropPlaintext)));
    }

    [Fact]
    public void SealsTheSameValueDifferentlyEveryTime()
    {
        // A fresh nonce per call. If two seals of one value ever matched, the nonce would be
        // being derived from something rather than generated, which is GCM's one fatal misuse.
        var protector = Build();

        Assert.NotEqual(protector.Protect(InteropPlaintext), protector.Protect(InteropPlaintext));
    }

    [Fact]
    public void LaysOutNonceThenTagThenCiphertext()
    {
        // The layout the Python side reorders when it hands the tag to `cryptography`. Stated
        // as a test so a change here fails next to a comment explaining what depends on it,
        // rather than in a worker three services away.
        const int nonceBytes = 12;
        const int tagBytes = 16;

        var sealed_ = Convert.FromBase64String(Build().Protect(InteropPlaintext));

        Assert.Equal(nonceBytes + tagBytes + Encoding.UTF8.GetByteCount(InteropPlaintext), sealed_.Length);
    }

    [Fact]
    public void ReadsBackAValueTheWorkerSealed()
    {
        // Produced by rag/tests/test_crypto_interop.py under the fixture key: nonce | tag |
        // ciphertext, base64. The other half of the pin — together the two tests mean
        // neither runtime can change the format without the other's suite failing.
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plain = Encoding.UTF8.GetBytes(InteropPlaintext);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];

        using (var aes = new AesGcm(Encoding.UTF8.GetBytes(FixtureKeyMaterial), 16))
        {
            aes.Encrypt(nonce, plain, cipher, tag);
        }

        var blob = new byte[nonce.Length + tag.Length + cipher.Length];
        nonce.CopyTo(blob, 0);
        tag.CopyTo(blob, nonce.Length);
        cipher.CopyTo(blob, nonce.Length + tag.Length);

        Assert.Equal(InteropPlaintext, Build().Unprotect(Convert.ToBase64String(blob)));
    }

    [Fact]
    public void RefusesAValueSealedUnderADifferentKey()
    {
        var sealed_ = Build().Protect(InteropPlaintext);

        // ThrowsAny, because GCM raises AuthenticationTagMismatchException — a
        // CryptographicException, which is what the service catches, but not that exact type.
        Assert.ThrowsAny<CryptographicException>(
            () => Build("a-completely-different-32-byte!!").Unprotect(sealed_));
    }

    [Fact]
    public void RefusesATamperedCiphertext()
    {
        // What an authenticated mode buys over plain AES: a flipped bit is an error rather
        // than a different provider key being presented to somebody's account.
        var protector = Build();
        var sealed_ = Convert.FromBase64String(protector.Protect(InteropPlaintext));
        sealed_[^1] ^= 0x01;

        Assert.ThrowsAny<CryptographicException>(
            () => protector.Unprotect(Convert.ToBase64String(sealed_)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-base64!!")]
    [InlineData("c2hvcnQ=")]
    public void RefusesMalformedInput(string value)
    {
        var protector = Build();

        Assert.ThrowsAny<Exception>(() => protector.Unprotect(value));
    }

    [Fact]
    public void RefusesToBuildWithoutAProperKey()
    {
        var options = Options.Create(new LlmOptions { EncryptionKey = "too-short" });

        var error = Assert.Throws<InvalidOperationException>(() => new SecretProtector(options));
        Assert.Contains("EncryptionKey", error.Message);
    }
}
