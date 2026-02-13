import base64
import ctypes
from ctypes import wintypes


# Windows DPAPI wrapper for per-user secret storage.
# This avoids storing API keys as reversible base64 in settings.json.


class _DATA_BLOB(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_byte)),
    ]


def _bytes_to_blob(data: bytes) -> _DATA_BLOB:
    buf = (ctypes.c_byte * len(data)).from_buffer_copy(data)
    return _DATA_BLOB(cbData=len(data), pbData=ctypes.cast(buf, ctypes.POINTER(ctypes.c_byte)))


def _blob_to_bytes(blob: _DATA_BLOB) -> bytes:
    if not blob.cbData:
        return b""
    return ctypes.string_at(blob.pbData, blob.cbData)


def _local_free(ptr) -> None:
    if ptr:
        ctypes.windll.kernel32.LocalFree(ptr)


def is_available() -> bool:
    try:
        _ = ctypes.windll.crypt32.CryptProtectData
        _ = ctypes.windll.crypt32.CryptUnprotectData
        return True
    except Exception:
        return False


def protect(plaintext: str) -> str:
    """
    Encrypt plaintext with DPAPI (CurrentUser scope). Returns base64 ciphertext.
    Raises RuntimeError on failure.
    """
    if not is_available():
        raise RuntimeError("DPAPI not available on this platform")

    raw = plaintext.encode("utf-8")
    in_blob = _bytes_to_blob(raw)
    out_blob = _DATA_BLOB()

    crypt32 = ctypes.windll.crypt32
    crypt32.CryptProtectData.argtypes = [
        ctypes.POINTER(_DATA_BLOB),
        wintypes.LPCWSTR,
        ctypes.POINTER(_DATA_BLOB),
        wintypes.LPVOID,
        wintypes.LPVOID,
        wintypes.DWORD,
        ctypes.POINTER(_DATA_BLOB),
    ]
    crypt32.CryptProtectData.restype = wintypes.BOOL

    ok = crypt32.CryptProtectData(
        ctypes.byref(in_blob),
        None,
        None,
        None,
        None,
        0,
        ctypes.byref(out_blob),
    )
    if not ok:
        raise RuntimeError("CryptProtectData failed")

    try:
        ciphertext = _blob_to_bytes(out_blob)
        return base64.b64encode(ciphertext).decode("ascii")
    finally:
        _local_free(out_blob.pbData)


def unprotect(ciphertext_b64: str) -> str:
    """
    Decrypt base64 ciphertext with DPAPI (CurrentUser scope). Returns plaintext.
    Raises RuntimeError on failure.
    """
    if not is_available():
        raise RuntimeError("DPAPI not available on this platform")

    ciphertext = base64.b64decode(ciphertext_b64.encode("ascii"))
    in_blob = _bytes_to_blob(ciphertext)
    out_blob = _DATA_BLOB()

    crypt32 = ctypes.windll.crypt32
    crypt32.CryptUnprotectData.argtypes = [
        ctypes.POINTER(_DATA_BLOB),
        ctypes.POINTER(wintypes.LPWSTR),
        ctypes.POINTER(_DATA_BLOB),
        wintypes.LPVOID,
        wintypes.LPVOID,
        wintypes.DWORD,
        ctypes.POINTER(_DATA_BLOB),
    ]
    crypt32.CryptUnprotectData.restype = wintypes.BOOL

    description = wintypes.LPWSTR()
    ok = crypt32.CryptUnprotectData(
        ctypes.byref(in_blob),
        ctypes.byref(description),
        None,
        None,
        None,
        0,
        ctypes.byref(out_blob),
    )
    if not ok:
        raise RuntimeError("CryptUnprotectData failed")

    try:
        plaintext_bytes = _blob_to_bytes(out_blob)
        return plaintext_bytes.decode("utf-8")
    finally:
        _local_free(out_blob.pbData)
        _local_free(description)

