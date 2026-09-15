"""Reading back the provider keys the API sealed.

The counterpart to ``Backend.Common.Security.SecretProtector``, and deliberately only half
of it: this service unseals keys and never seals one. Writing a credential is the API's
job, and a worker that could write one would be a second place for that logic to live.
"""

from __future__ import annotations

import base64

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# The layout SecretProtector writes: a 12-byte nonce, the 16-byte GCM tag, then the
# ciphertext, base64-encoded as one string.
_NONCE_BYTES = 12
_TAG_BYTES = 16


class SecretUnsealError(RuntimeError):
    """The stored key could not be read: wrong encryption key, or a damaged row."""


def decode_encryption_key(encoded: str) -> bytes:
    """The 32 raw bytes behind the base64 the API and this service share."""
    try:
        key = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError) as error:
        raise SecretUnsealError("RAG_ENCRYPTION_KEY is not valid base64.") from error

    if len(key) != 32:
        raise SecretUnsealError(
            f"RAG_ENCRYPTION_KEY decodes to {len(key)} bytes; AES-256-GCM needs 32. "
            "It must be the same value as the API's Llm:EncryptionKey."
        )

    return key


def unseal(ciphertext: str, key: bytes) -> str:
    """Recovers a sealed secret, or raises.

    A failure here is nearly always one thing — this process and the API disagree about the
    encryption key — so the message says so rather than describing the cryptography.
    """
    try:
        blob = base64.b64decode(ciphertext, validate=True)
    except (ValueError, TypeError) as error:
        raise SecretUnsealError("The stored secret is not valid base64.") from error

    if len(blob) < _NONCE_BYTES + _TAG_BYTES:
        raise SecretUnsealError("The stored secret is too short to be a sealed value.")

    nonce = blob[:_NONCE_BYTES]
    tag = blob[_NONCE_BYTES : _NONCE_BYTES + _TAG_BYTES]
    body = blob[_NONCE_BYTES + _TAG_BYTES :]

    # NOTE: `cryptography` wants the tag appended to the ciphertext; .NET's AesGcm keeps
    # them apart. Same bytes, different order — this line is the whole of the difference.
    try:
        plaintext = AESGCM(key).decrypt(nonce, body + tag, None)
    except InvalidTag as error:
        raise SecretUnsealError(
            "The stored provider key could not be unsealed. RAG_ENCRYPTION_KEY probably "
            "does not match the API's Llm:EncryptionKey."
        ) from error

    return plaintext.decode("utf-8")
