#!/usr/bin/env python3
"""tRPC wiring check (robust, convention-based).

1. Every router file's procedure keys are the object keys whose value starts with a
   `*Procedure` builder. Nested routers are `key: someRouter`.
2. Diff that tree against every `trpc.<a>.<b>[.<c>]` reference in the UI.
"""
import re
from pathlib import Path

WEB = Path('/home/user/openvpm-ai/apps/web')
R = WEB / 'server' / 'routers'
FILES = sorted([f for f in list(R.rglob('*.ts')) if '.test.' not in f.name])

# all procedure-builder identifiers used in the server code
builders = set()
for f in FILES:
    for m in re.finditer(r'const\s+(\w*[Pp]rocedure)\s*=', f.read_text(encoding='utf-8')):
        builders.add(m.group(1))
builders |= {'protectedProcedure', 'publicProcedure', 'portalProcedure'}

KEY_RE = re.compile(r'^\s*([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$.]*)', re.M)

info = {}   # file -> {'procs':set, 'subs':{key:var}}
for f in FILES:
    text = f.read_text(encoding='utf-8')
    local_procs = set(re.findall(r'const\s+(\w+)\s*=\s*\w*[Pp]rocedure\b', text))
    procs, subs = set(), {}
    for m in KEY_RE.finditer(text):
        key, val = m.group(1), m.group(2)
        head = val.split('.')[0]
        if head in builders or head in local_procs or head.endswith('Procedure'):
            procs.add(key)
        elif re.fullmatch(r'\w+Router', val):
            subs[key] = val
    info[f] = {'procs': procs, 'subs': subs, 'text': text}

# file(s) that define each router variable
def defining_file(var):
    for f in FILES:
        if re.search(rf'const {re.escape(var)}\s*=\s*(?:createRouter|t\.router)', info[f]['text']):
            return f
    return None

app_text = (R / '_app.ts').read_text(encoding='utf-8')
root_map = dict(re.findall(r'^\s{2}([a-zA-Z0-9_]+)\s*:\s*(\w+)\s*,?\s*$', app_text, re.M))

avail, unresolved = {}, []
for key, var in root_map.items():
    f = defining_file(var)
    if not f:
        unresolved.append(f'{key}->{var}')
        continue
    avail[key] = info[f]['procs']
    for subkey, subvar in info[f]['subs'].items():
        sf = defining_file(subvar)
        if not sf:
            continue
        avail[f'{key}.{subkey}'] = info[sf]['procs']

SUFFIX = {'useQuery', 'useMutation', 'useInfiniteQuery', 'useSuspenseQuery', 'useQueries',
          'invalidate', 'invalidateQueries', 'refetch', 'prefetch', 'reset', 'cancel',
          'setData', 'setInfiniteData', 'getQueryData', 'ensureQueryData', 'setQueryData',
          'useError', 'fetch', 'branches', 'useUtils', 'setQueriesData', 'getMutationData'}
CALL = re.compile(r'\btrpc\.([a-zA-Z0-9_]+)((?:\.[a-zA-Z0-9_]+){1,3})')

used, bad = {}, {}
for base in ('app', 'components', 'lib', 'config'):
    for p in (WEB / base).rglob('*.ts*'):
        if '.test.' in p.name or '__tests__' in p.parts:
            continue
        txt = p.read_text(encoding='utf-8')
        for m in CALL.finditer(txt):
            parts = [m.group(1)] + m.group(2).lstrip('.').split('.')
            while len(parts) > 1 and parts[-1] in SUFFIX:
                parts = parts[:-1]
            if len(parts) < 2 or parts[0] not in avail:
                if len(parts) >= 1 and parts[0] not in avail:
                    bad.setdefault(f'UNKNOWN ROUTER "{parts[0]}"', set()).add(str(p.relative_to(WEB)))
                continue
            ns = '.'.join(parts[:2])
            if len(parts) >= 3 and ns in avail:
                proc = parts[2]
                used.setdefault(ns, set()).add(proc)
                if avail[ns] and proc not in avail[ns]:
                    bad.setdefault(f'{ns}.{proc}', set()).add(str(p.relative_to(WEB)))
                continue
            proc = parts[1]
            used.setdefault(parts[0], set()).add(proc)
            if proc not in avail[parts[0]] and ns not in avail:
                bad.setdefault(f'{ns}.{proc}', set()).add(str(p.relative_to(WEB)))

print(f'routers: {len([k for k in avail if "." not in k])}  '
      f'namespaces: {len(avail)}  procedures: {sum(len(v) for v in avail.values())}'
      + (f'  UNRESOLVED: {unresolved}' if unresolved else ''))
print(f'\n### BROKEN UI -> tRPC references (procedure not found in router): {len(bad)}')
for k in sorted(bad):
    print(f'  !! {k}\n        <- ' + '\n        <- '.join(sorted(bad[k])[:4]))

dead_tot, dead_lines = 0, []
for ns in sorted(k for k in avail if '.' not in k):
    called = used.get(ns, set())
    for n2, ps in used.items():
        if n2.startswith(ns + '.'):
            called |= ps
    dead = sorted(p for p in avail[ns] if p not in called)
    dead_tot += len(dead)
    if dead:
        dead_lines.append(f'  {ns} ({len(dead)}): ' + ', '.join(dead[:12]) + (' …' if len(dead) > 12 else ''))
print(f'\n### router procedures never called from UI code: {dead_tot}')
print('\n'.join(dead_lines[:24]))
