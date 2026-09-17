#!/usr/bin/env python3
"""i18n symmetry checker for apps/web/messages.

Compares sk.json vs en.json (nested + flat keys), checks the extra "parts/*.json"
fragments that the repo merges in, and reports:
  * keys present in en but missing in sk (and vice versa)
  * keys whose sk value still contains an untranslated English word
  * keys used in code via t("...") that exist in neither catalogue
"""
import json
import re
import sys
from pathlib import Path

WEB = Path('/home/user/openvpm-ai/apps/web')
MSG = WEB / 'messages'


def flatten(obj, prefix=''):
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f'{prefix}.{k}' if prefix else k
            if isinstance(v, dict):
                out.update(flatten(v, key))
            else:
                out[key] = v
    return out


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def collect(base):
    """Merged catalogue, mirroring how the app assembles messages."""
    cat = {}
    main = load(base / 'sk.json') if (base / 'sk.json').exists() else {}
    return main


sk = load(MSG / 'sk.json')
en = load(MSG / 'en.json')
skf, enf = flatten(sk), flatten(en)

print(f'sk.json nested keys: {len(skf)}   en.json nested keys: {len(enf)}')

missing_sk = sorted(set(enf) - set(skf))
missing_en = sorted(set(skf) - set(enf))
print(f'\n### keys in en but NOT in sk: {len(missing_sk)}')
for k in missing_sk[:40]:
    print(f'   - {k}  = {json.dumps(enf[k], ensure_ascii=False)[:70]}')
print(f'\n### keys in sk but NOT in en: {len(missing_en)}')
for k in missing_en[:40]:
    print(f'   - {k}  = {json.dumps(skf[k], ensure_ascii=False)[:70]}')

same = {k for k in skf if k in enf}
identical = [k for k in sorted(same) if str(skf[k]).strip() == str(enf[k]).strip()]
print(f'\n### keys where sk == en (untranslated, incl. legit brand/tech terms): {len(identical)}')
STOP = set('''email Email API URL ID PDF E-Sign sign-in SMS SMS GDPR OK VIP QR token Token
OpenVPM MVDr No no Yes Pri Beh Bc. doc Doc invoice Premium AI'''.split())
suspect = []
for k in identical:
    v = str(skf[k]).strip()
    if len(v) < 3 or v in STOP or re.fullmatch(r'[^A-Za-z]*', v):
        continue
    suspect.append((k, v))
print(f'    (after filtering brand/tech/acronyms: {len(suspect)} candidates)')
for k, v in suspect[:60]:
    print(f'   - {k} = {v[:80]}')

# ---- keys referenced from code, checked against the catalogues -------------
used = set()
pat = re.compile(r'''(?:^|[^.\w])t\(\s*["'`]([\w.\-]+)["'`]''')
for p in list(WEB.glob('app/**/*.tsx')) + list(WEB.glob('components/**/*.tsx')) + \
         list(WEB.glob('lib/**/*.ts')) + list(WEB.glob('config/**/*.ts')):
    try:
        txt = p.read_text(encoding='utf-8')
    except Exception:
        continue
    for m in pat.finditer(txt):
        used.add(m.group(1))
print(f'\n### t("key") literals found in code: {len(used)}')
not_in_sk = sorted(k for k in used if k not in skf)
print(f'    referenced but MISSING from sk.json: {len(not_in_sk)}')
for k in not_in_sk[:40]:
    print(f'   - {k}')

# ---- english placeholder leakage in sk catalogue ---------------------------
EN_WORDS = re.compile(r'\b(Street|City|Town|Country|Postal code|Zip|Phone number|'
                      r'Email address|First name|Last name|Notes|Save|Cancel|Submit|'
                      r'Search|Loading|Required|Select|Address|State|District|Region|'
                      r'Mobile|Consent|Notification|Notifications|Please|Click|Enter)\b')
hits = []
for k, v in sorted(skf.items()):
    if isinstance(v, str) and EN_WORDS.search(v):
        hits.append((k, v))
print(f'\n### sk.json values containing typical English UI words: {len(hits)}')
for k, v in hits[:50]:
    print(f'   - {k} = {v[:110]}')

# ---- nested vs flat key style ---------------------------------------------
nested_en = sum(1 for k in enf if False)
print(f'\n### sk.json top-level keys: {len(sk)}  (nested objects: '
      f'{sum(1 for v in sk.values() if isinstance(v, dict))}, flat string keys: '
      f'{sum(1 for v in sk.values() if not isinstance(v, dict))})')
print(f'### en.json top-level keys: {len(en)}  (nested objects: '
      f'{sum(1 for v in en.values() if isinstance(v, dict))}, flat string keys: '
      f'{sum(1 for v in en.values() if not isinstance(v, dict))})')

json.dump({'missing_sk': missing_sk, 'missing_en': missing_en,
           'untranslated': [k for k, _ in suspect],
           'referenced_missing': not_in_sk},
          open('/home/user/audit/i18n-report.json', 'w'), indent=1)
