"""Collect every English UI string used with tr("...") (plus the indirect ones in
scripts/i18n_extra.json, for text passed through variables) so translations can be
checked for completeness. Run: python3 scripts/i18n_extract.py"""
import glob, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from i18nkeys import key_for

def collect():
    found = {}
    pat = re.compile(r'\btr\(("(?:[^"\\\n]|\\.)*")')
    for pattern in ("app/**/*.tsx", "app/**/*.jsx", "components/*.tsx", "components/*.jsx", "components/*.js", "services/*.ts", "utils/*.ts", "utils/*.js"):
        for f in glob.glob(os.path.join(ROOT, pattern), recursive=True):
            if ".test." in f: continue
            for m in pat.finditer(open(f).read()):
                found.setdefault(json.loads(m.group(1)), set()).add(os.path.relpath(f, ROOT))
    extra = json.load(open(os.path.join(ROOT, "scripts/i18n_extra.json")))
    for t in extra: found.setdefault(t, set()).add("(indirect)")
    return {t: v for t, v in found.items() if t.strip() and t != "9tel"}

if __name__ == "__main__":
    s = collect()
    print(len(s), "strings")
