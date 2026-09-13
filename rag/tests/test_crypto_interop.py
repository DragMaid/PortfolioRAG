"""The seam between the two runtimes.

The API seals an author's provider key with .NET's ``AesGcm``; this service unseals it with
``cryptography``'s. Same algorithm, same key, different byte layout conventions — .NET keeps
the authentication tag separate, ``cryptography`` expects it appended to the ciphertext.
``rag.crypto`` reorders them, and one transposed line there would mean every analysis
failing at the last moment with an error about a provider key.

So the fixture below is real output from the C# side, produced by ``SecretProtector`` under
the key the .NET test harness uses. It is checked in rather than generated, which is the
whole point: it pins the wire format, so a change to either implementation that breaks the
other fails here rather than in production.

The matching assertion on the .NET side lives in ``backend.Tests/SecretProtectorTests.cs``.
"""

from __future__ import annotations

import base64
import os

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from rag.crypto import SecretUnsealError, decode_encryption_key, unseal

# The key TestHarness configures: 32 ASCII bytes, base64-encoded.
FIXTURE_KEY = base64.b64encode(b"test-only-fixed-key-32-bytes!!!!").decode()

# Produced by Backend.Common.Security.SecretProtector.Protect under that key.
CSHARP_SEALED = "32PGD6xV6m8K1ST0lzQ3AG5ZoetCWkhlLA0l97Ghs1VD/lbcFZp2fbPFHHA7dPw1w8KExfoH"

EXPECTED_PLAINTEXT = "sk-ant-interop-probe-value"


def test_a_value_sealed_by_the_api_unseals_here():
    key = decode_encryption_key(FIXTURE_KEY)

    assert unseal(CSHARP_SEALED, key) == EXPECTED_PLAINTEXT


def test_a_value_sealed_here_has_the_layout_the_api_expects():
    """Round-trips through this module's own reader, using the API's documented layout.

    Sealing lives in the test rather than in ``rag.crypto`` on purpose: writing a credential
    is the API's job, and a worker that could seal one would be a second place for that
    logic to live and drift.
    """
    key = decode_encryption_key(FIXTURE_KEY)

    nonce = os.urandom(12)
    body = AESGCM(key).encrypt(nonce, b"sk-ant-round-trip", None)

    # nonce | tag | ciphertext, which is what SecretProtector writes.
    ciphertext, tag = body[:-16], body[-16:]
    blob = base64.b64encode(nonce + tag + ciphertext).decode()

    assert unseal(blob, key) == "sk-ant-round-trip"


def test_the_wrong_key_is_rejected_rather_than_returning_rubbish():
    """GCM's whole reason for being here: a mismatch has to raise, not decode to noise."""
    other = decode_encryption_key(base64.b64encode(b"a-different-32-byte-key!!!!!!!!!").decode())

    with pytest.raises(SecretUnsealError, match="EncryptionKey"):
        unseal(CSHARP_SEALED, other)


def test_a_tampered_ciphertext_is_rejected():
    key = decode_encryption_key(FIXTURE_KEY)
    blob = bytearray(base64.b64decode(CSHARP_SEALED))
    blob[-1] ^= 0x01

    with pytest.raises(SecretUnsealError):
        unseal(base64.b64encode(bytes(blob)).decode(), key)


@pytest.mark.parametrize(
    "value",
    ["", "not base64!!", base64.b64encode(b"short").decode()],
)
def test_malformed_keys_are_refused_with_an_explanation(value: str):
    with pytest.raises(SecretUnsealError):
        decode_encryption_key(value)
