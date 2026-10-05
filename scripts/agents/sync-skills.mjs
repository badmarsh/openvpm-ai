import fs from 'node:fs';
import path from 'node:path';

const isCheck = process.argv.includes('--check');

const srcDir = path.resolve('.agents/skills');
const destDir = path.resolve('.claude/skills');

// Read third-party skills from skills-lock.json
let thirdParty = new Set(['impeccable', 'web-design-guidelines']);
if (fs.existsSync('skills-lock.json')) {
  try {
    const lock = JSON.parse(fs.readFileSync('skills-lock.json', 'utf8'));
    if (lock.skills) {
      thirdParty = new Set(Object.keys(lock.skills));
    }
  } catch (e) {
    console.warn('Could not parse skills-lock.json, using defaults.');
  }
}

function getFilesRecursively(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(srcDir)) {
  console.log('No .agents/skills directory found.');
  process.exit(0);
}

const skills = fs.readdirSync(srcDir).filter(name => {
  const full = path.join(srcDir, name);
  return fs.statSync(full).isDirectory() && !thirdParty.has(name);
});

let driftFound = false;

if (isCheck) {
  // Verify each first-party skill in .agents/skills exists and matches .claude/skills
  for (const skill of skills) {
    const sPath = path.join(srcDir, skill);
    const dPath = path.join(destDir, skill);
    if (!fs.existsSync(dPath)) {
      console.error(`Drift: skill ${skill} missing in .claude/skills`);
      driftFound = true;
      continue;
    }
    const sFiles = getFilesRecursively(sPath);
    for (const sf of sFiles) {
      const rel = path.relative(sPath, sf);
      const df = path.join(dPath, rel);
      if (!fs.existsSync(df)) {
        console.error(`Drift: file ${rel} in skill ${skill} missing in .claude/skills`);
        driftFound = true;
      } else {
        const sc = fs.readFileSync(sf, 'utf8');
        const dc = fs.readFileSync(df, 'utf8');
        if (sc !== dc) {
          console.error(`Drift: content mismatch in skill ${skill} file ${rel}`);
          driftFound = true;
        }
      }
    }
  }

  // Also check if .claude/skills has any stale skills not in .agents/skills
  if (fs.existsSync(destDir)) {
    const dSkills = fs.readdirSync(destDir).filter(n => fs.statSync(path.join(destDir, n)).isDirectory());
    for (const ds of dSkills) {
      if (!skills.includes(ds)) {
        console.error(`Drift: extra or untracked skill ${ds} in .claude/skills`);
        driftFound = true;
      }
    }
  }

  if (driftFound) {
    console.error('Skills check failed. Run "pnpm skills:sync" to synchronize.');
    process.exit(1);
  } else {
    console.log('Skills in sync (.agents/skills <-> .claude/skills).');
    process.exit(0);
  }
} else {
  // Synchronize
  fs.mkdirSync(destDir, { recursive: true });
  for (const skill of skills) {
    const sPath = path.join(srcDir, skill);
    const dPath = path.join(destDir, skill);
    copyDirRecursive(sPath, dPath);
    console.log(`Synchronized skill: ${skill}`);
  }

  // Remove any stale directories in .claude/skills that are not first-party skills
  const dSkills = fs.readdirSync(destDir).filter(n => fs.statSync(path.join(destDir, n)).isDirectory());
  for (const ds of dSkills) {
    if (!skills.includes(ds)) {
      fs.rmSync(path.join(destDir, ds), { recursive: true, force: true });
      console.log(`Removed stale skill from .claude/skills: ${ds}`);
    }
  }

  console.log('Skills successfully synchronized.');
}
