"""Existing server credentials encrypted for the current Windows user."""
import ctypes
from ctypes import wintypes
import os
from pathlib import Path


class Blob(ctypes.Structure):
    _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_ubyte))]


def _crypt(data, decrypt=False):
    if os.name != "nt":
        raise RuntimeError("Use SUPABASE_SERVICE_KEY on this platform; Windows DPAPI is unavailable")
    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = Blob()
    crypt32=ctypes.WinDLL('crypt32',use_last_error=True)
    kernel32=ctypes.WinDLL('kernel32',use_last_error=True)
    crypt32.CryptProtectData.argtypes=[ctypes.POINTER(Blob),wintypes.LPCWSTR,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(Blob)]
    crypt32.CryptUnprotectData.argtypes=[ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(Blob)]
    kernel32.LocalFree.argtypes=[ctypes.c_void_p]
    kernel32.LocalFree.restype=ctypes.c_void_p
    if decrypt:
        ok = crypt32.CryptUnprotectData(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(target))
    else:
        ok = crypt32.CryptProtectData(ctypes.byref(source), "Boses Bantay indexing worker", None, None, None, 1, ctypes.byref(target))
    if not ok:
        raise ctypes.WinError()
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        kernel32.LocalFree(target.data)


def credential_path():
    return Path(os.getenv("BB_WORKER_CREDENTIAL_FILE", str(Path(__file__).resolve().parent.parent / ".private" / "worker-key.dpapi")))


def save_key(key):
    path = credential_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_bytes(_crypt(key.encode("utf-8")))
    os.replace(temporary, path)


def load_key():
    value = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if value:
        return value
    path = credential_path()
    return _crypt(path.read_bytes(), decrypt=True).decode("utf-8") if path.is_file() else ""
