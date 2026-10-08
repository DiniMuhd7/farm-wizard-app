"""Python twin of keyFor() in utils/i18n.js — the two MUST stay identical."""
import re

def _fnv1a(text: str) -> str:
    h = 0x811C9DC5
    data = text.encode("utf-16-le")  # JS charCodeAt works on UTF-16 code units
    for i in range(0, len(data), 2):
        h ^= data[i] | (data[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    n, digits = h, "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while True:
        out = digits[n % 36] + out
        n //= 36
        if n == 0:
            return out

def key_for(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r"\{\{[^}]*\}\}", "", slug)
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = re.sub(r"^_+|_+$", "", slug)[:40]
    return f"ui.{slug}_{_fnv1a(text)}"
