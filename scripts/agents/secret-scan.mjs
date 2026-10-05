import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const isAll = process.argv.includes('--all');

function getFilesToScan() {
  if (isAll) {
    try {
      const out = execSync('git ls-files', { encoding: 'utf8' });
      return out.split(/\r?\n/).filter(Boolean);
    } catch {
      return [];
    }
  } else {
    try {
      const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
      const staged = out.split(/\r?\n/).filter(Boolean);
      if (staged.length > 0) return staged;
      // If nothing staged, scan tracked files by default
      const allOut = execSync('git ls-files', { encoding: 'utf8' });
      return allOut.split(/\r?\n/).filter(Boolean);
    } catch {
      return [];
    }
  }
}

const IGNORE_FILES = new Set([
  '.env.example',
  'pnpm-lock.yaml',
  'package-lock.json',
  'skills-lock.json'
]);

function shouldIgnore(file) {
  const norm = file.replace(/\\/g, '/');
  if (IGNORE_FILES.has(path.basename(file))) return true;
  if (norm.includes('.local')) return true;
  if (norm.endsWith('.png') || norm.endsWith('.jpg') || norm.endsWith('.ico') || norm.endsWith('.svg') || norm.endsWith('.woff2')) return true;
  if (norm.includes('__tests__') || norm.includes('.test.') || norm.includes('test-fixtures')) return true;
  // Ignore scripts/agents/secret-scan.mjs and guard.mjs themselves which define patterns
  if (norm.includes('scripts/agents/secret-scan.mjs') || norm.includes('scripts/agents/guard.mjs')) return true;
  return false;
}

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /sk_live_[0-9a-zA-Z]{20,}/,
  /sk_test_[0-9a-zA-Z]{20,}/,
  /Bearer\s+ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/,
  /ANTHROPIC_API_KEY\s*=\s*['"]?sk-[a-zA-Z0-9_-]{20,}['"]?/,
  /TELNYX_API_KEY\s*=\s*['"]?KEY[a-zA-Z0-9_-]{20,}['"]?/,
  /STRIPE_SECRET_KEY\s*=\s*['"]?sk_[a-zA-Z0-9_-]{20,}['"]?/,
  /RESEND_API_KEY\s*=\s*['"]?re_[a-zA-Z0-9_-]{20,}['"]?/
];

const files = getFilesToScan().filter(f => !shouldIgnore(f) && fs.existsSync(f));
let hasErrors = false;

for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const regex of SECRET_PATTERNS) {
    if (regex.test(content)) {
      console.error(`SECRET LEAK DETECTED in ${file}: matches pattern ${regex}`);
      hasErrors = true;
    }
  }
}

if (hasErrors) {
  console.error('\nSecret scan FAILED. Sensitive tokens or private keys detected.');
  process.exit(1);
} else {
  console.log(`Secret scan passed (${files.length} files scanned).`);
  process.exit(0);
}
