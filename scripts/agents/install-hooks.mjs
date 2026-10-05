import { execSync } from 'node:child_process';
import fs from 'node:fs';

try {
  if (fs.existsSync('.git')) {
    execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
    console.log('Successfully set core.hooksPath to .githooks');
  } else {
    console.log('.git not found, skipping hooks configuration.');
  }
} catch (e) {
  console.warn('Could not configure git hooksPath:', e.message);
}
