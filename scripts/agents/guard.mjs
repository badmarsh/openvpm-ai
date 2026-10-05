import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

let hasErrors = false;

function fail(msg) {
  console.error('FAIL: ' + msg);
  hasErrors = true;
}

function getFilesRecursively(dir, filterExt = ['.md', '.mjs', '.js', '.ts', '.json']) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath, filterExt));
    } else if (entry.isFile()) {
      if (!filterExt || filterExt.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

console.log('=== Running Agent Guard Checks ===');

// 1. Forbidden directories check
const forbiddenDirs = ['apps/web/app/[locale]'];
for (const dir of forbiddenDirs) {
  if (fs.existsSync(dir)) {
    fail(`Forbidden route directory exists: ${dir} (violates canonical non-localized URLs)`);
  }
}

// 2. Scan agent docs for infrastructure identifiers & secrets
const INFRA_PATTERNS = [
  'wdunfq',
  'DcWUBuOSe4H0UfF',
  'pvdhIxlCIhYTKvnmrZ8Mk',
  'blxZb8obBRSF0J42JjPlL',
  'XhgvbElGuBewwa6a3xjpy',
  'dgpMIXk6UxZf_nS2fH3xU',
  'KCp595z',
  'root@dev.significa.sk',
  'cfoqxx',
  'ygh6nf'
];

const agentDocFiles = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'apps/web/AGENTS.md',
  'packages/db/AGENTS.md',
  'e2e/AGENTS.md',
  ...getFilesRecursively('.agents/skills'),
  ...getFilesRecursively('.claude')
].filter(f => {
  if (!fs.existsSync(f)) return false;
  // Exclude gitignored local files
  const base = path.basename(f);
  if (base === 'AGENTS.local.md' || base === 'settings.local.json') return false;
  return true;
});

for (const file of agentDocFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of INFRA_PATTERNS) {
    if (content.includes(pattern)) {
      fail(`Forbidden infrastructure pattern '${pattern}' detected in ${file}`);
    }
  }
}

// 3. Resolve markdown links in agent docs
const linkRegex = /\[([^\]]+)\]\((?!https?:|mailto:|#)([^)]+)\)/g;
for (const file of agentDocFiles.filter(f => f.endsWith('.md'))) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const rawTarget = match[2].split('#')[0].trim();
    if (!rawTarget) continue;
    // Resolve relative to the file directory or repo root if starts with /
    let resolved;
    if (rawTarget.startsWith('/')) {
      resolved = path.resolve('.' + rawTarget);
    } else {
      resolved = path.resolve(path.dirname(file), rawTarget);
    }
    if (!fs.existsSync(resolved)) {
      fail(`Broken markdown link in ${file}: '${rawTarget}' (target not found at ${resolved})`);
    }
  }
}

// 4. Skills sync check
try {
  execFileSync(process.execPath, ['scripts/agents/sync-skills.mjs', '--check'], { stdio: 'inherit' });
} catch (e) {
  fail('Skills are not in sync between .agents/skills and .claude/skills');
}

if (hasErrors) {
  console.error('\nAgent guard check FAILED. Fix issues above.');
  process.exit(1);
} else {
  console.log('\nAll agent guard checks PASSED.');
  process.exit(0);
}
