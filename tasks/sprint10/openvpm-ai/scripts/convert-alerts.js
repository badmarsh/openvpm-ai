#!/usr/bin/env node
/**
 * GitHub Alert -> Outline-compatible Emoji Blockquote Converter
 *
 * Converts GitHub alerts:
 *   > [!NOTE]      -> > 📝 **Poznámka:**
 *   > [!TIP]       -> > 💡 **Tip:**
 *   > [!IMPORTANT] -> > ⚠️ **Dôležité:**
 *   > [!WARNING]   -> > ⚠️ **Upozornenie:**
 *   > [!CAUTION]   -> > 🚨 **Pozor:**
 *
 * Supports Slovak ('sk', default) and English ('en').
 */

const fs = require('fs');
const path = require('path');

const ALERT_MAP = {
  sk: {
    NOTE: '📝 **Poznámka:**',
    TIP: '💡 **Tip:**',
    IMPORTANT: '⚠️ **Dôležité:**',
    WARNING: '⚠️ **Upozornenie:**',
    CAUTION: '🚨 **Pozor:**',
  },
  en: {
    NOTE: '📝 **Note:**',
    TIP: '💡 **Tip:**',
    IMPORTANT: '⚠️ **Important:**',
    WARNING: '⚠️ **Warning:**',
    CAUTION: '🚨 **Caution:**',
  },
};

/**
 * Convert GitHub alerts in a markdown string to Outline-compatible emoji blockquotes.
 * @param {string} text - Markdown content
 * @param {'sk'|'en'} [lang='sk'] - Language for labels
 * @returns {string} Converted markdown
 */
function convertGitHubAlerts(text, lang = 'sk') {
  if (!text || typeof text !== 'string') return text;
  const dict = ALERT_MAP[lang] || ALERT_MAP.sk;

  return text.replace(
    /^([ \t]*>[ \t]*)\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]([ \t]*)([^\r\n]*)$/gim,
    (match, prefix, tag, space, rest) => {
      const upperTag = tag.toUpperCase();
      const rep = dict[upperTag] || dict.NOTE;
      const cleanPrefix = prefix.endsWith(' ') ? prefix : prefix + ' ';
      if (rest && rest.trim().length > 0) {
        return `${cleanPrefix}${rep} ${rest.trimStart()}`;
      }
      return `${cleanPrefix}${rep}`;
    }
  );
}

/**
 * Check if text contains any GitHub alert tags.
 * @param {string} text
 * @returns {boolean}
 */
function hasGitHubAlerts(text) {
  if (!text) return false;
  return />\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(text);
}

/**
 * Convert a file on disk.
 * @param {string} filePath
 * @param {'sk'|'en'} [lang='sk']
 * @returns {boolean} Whether changes were written
 */
function convertFile(filePath, lang = 'sk') {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!hasGitHubAlerts(content)) {
    return false;
  }
  const converted = convertGitHubAlerts(content, lang);
  fs.writeFileSync(filePath, converted, 'utf8');
  return true;
}

/**
 * Convert all markdown files in a directory recursively.
 * @param {string} dirPath
 * @param {'sk'|'en'} [lang='sk']
 * @returns {string[]} List of modified files
 */
function convertDirectory(dirPath, lang = 'sk') {
  const modified = [];
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (convertFile(fullPath, lang)) {
          modified.push(fullPath);
        }
      }
    }
  }
  walk(dirPath);
  return modified;
}

/**
 * Update all documents in Outline that contain GitHub alerts.
 * Uses C:/Users/marek/.gemini/config/outline-client.js.
 */
async function syncOutlineToEmojiBlockquotes() {
  const { apiRequest } = require('C:/Users/marek/.gemini/config/outline-client.js');
  console.log('Fetching Outline collections...');
  const collections = await apiRequest('collections.list', { limit: 100 });
  console.log(`Found ${collections.length} collections.`);

  let totalChecked = 0;
  let totalUpdated = 0;

  for (const col of collections) {
    console.log(`\nChecking collection: ${col.name} (${col.id})`);
    const docs = await apiRequest('documents.list', { collectionId: col.id, limit: 100 });

    for (const d of docs) {
      totalChecked++;
      const doc = await apiRequest('documents.info', { id: d.id });
      if (!hasGitHubAlerts(doc.text)) {
        continue;
      }

      console.log(`  -> Converting alerts in: "${doc.title}" (${doc.id})`);
      const newText = convertGitHubAlerts(doc.text, 'sk');

      // Strip leading emoji from title to avoid duplication with Outline doc icon
      const cleanTitle = doc.title.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').trim();

      await apiRequest('documents.update', {
        id: doc.id,
        title: cleanTitle,
        text: newText,
        publish: true,
        done: true,
      });

      totalUpdated++;
      console.log(`  ✓ Updated Outline doc: "${cleanTitle}"`);

      // Rate limit protection
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  console.log(`\nOutline sync finished: ${totalChecked} checked, ${totalUpdated} updated.`);
}

// CLI handler
async function main() {
  const args = process.argv.slice(2);
  const flag = args[0];

  if (!flag || flag === '--help' || flag === '-h') {
    console.log(`
Usage:
  node scripts/convert-alerts.js --test               # Run built-in unit tests
  node scripts/convert-alerts.js --file <path>        # Convert single markdown file
  node scripts/convert-alerts.js --dir <path>         # Convert all markdown files in directory
  node scripts/convert-alerts.js --wiki               # Convert all docs/wiki markdown files locally
  node scripts/convert-alerts.js --sync-outline       # Scan and update all Outline wiki docs
  node scripts/convert-alerts.js --all                # Convert docs/wiki locally AND sync to Outline
    `);
    process.exit(0);
  }

  if (flag === '--test') {
    console.log('Running convertGitHubAlerts unit tests...');
    const tests = [
      {
        in: '> [!NOTE] Pre fyzické kliniky s vysokou frekvenciou',
        expected: '> 📝 **Poznámka:** Pre fyzické kliniky s vysokou frekvenciou',
      },
      {
        in: '> [!IMPORTANT] **ZÁKONNÁ 48-HODINOVÁ LEHOTA:** Text',
        expected: '> ⚠️ **Dôležité:** **ZÁKONNÁ 48-HODINOVÁ LEHOTA:** Text',
      },
      {
        in: '> [!WARNING] Pozor na certifikát',
        expected: '> ⚠️ **Upozornenie:** Pozor na certifikát',
      },
      {
        in: '> [!TIP] Tip pre vás',
        expected: '> 💡 **Tip:** Tip pre vás',
      },
      {
        in: '> [!CAUTION] Nebezpečná operácia',
        expected: '> 🚨 **Pozor:** Nebezpečná operácia',
      },
      {
        in: '> [!NOTE]',
        expected: '> 📝 **Poznámka:**',
      },
      {
        in: '>[!NOTE] Bez medzery za >',
        expected: '> 📝 **Poznámka:** Bez medzery za >',
      },
    ];

    let passed = 0;
    for (const t of tests) {
      const out = convertGitHubAlerts(t.in, 'sk');
      if (out === t.expected) {
        passed++;
        console.log(`✓ OK: ${t.in}`);
      } else {
        console.error(`✗ FAIL: ${t.in}`);
        console.error(`   Got:      ${out}`);
        console.error(`   Expected: ${t.expected}`);
      }
    }

    // English test
    const enOut = convertGitHubAlerts('> [!NOTE] English note', 'en');
    if (enOut === '> 📝 **Note:** English note') {
      passed++;
      console.log('✓ OK: English NOTE');
    } else {
      console.error('✗ FAIL: English NOTE');
    }

    console.log(`\nTests finished: ${passed}/${tests.length + 1} passed.`);
    process.exit(passed === tests.length + 1 ? 0 : 1);
  }

  if (flag === '--file') {
    const file = args[1];
    if (!file) {
      console.error('Missing file path argument');
      process.exit(1);
    }
    const modified = convertFile(path.resolve(file));
    console.log(modified ? `✓ Converted: ${file}` : `- No alerts found: ${file}`);
    process.exit(0);
  }

  if (flag === '--dir') {
    const dir = args[1];
    if (!dir) {
      console.error('Missing directory path argument');
      process.exit(1);
    }
    const modified = convertDirectory(path.resolve(dir));
    console.log(`✓ Converted ${modified.length} files in ${dir}:`);
    for (const f of modified) console.log(`  - ${path.relative(process.cwd(), f)}`);
    process.exit(0);
  }

  if (flag === '--wiki') {
    const wikiDir = path.resolve(__dirname, '../docs/wiki');
    const modified = convertDirectory(wikiDir);
    console.log(`✓ Converted ${modified.length} files in docs/wiki:`);
    for (const f of modified) console.log(`  - ${path.relative(process.cwd(), f)}`);
    process.exit(0);
  }

  if (flag === '--sync-outline') {
    await syncOutlineToEmojiBlockquotes();
    process.exit(0);
  }

  if (flag === '--all') {
    console.log('1. Converting all local docs/wiki markdown files...');
    const wikiDir = path.resolve(__dirname, '../docs/wiki');
    const modified = convertDirectory(wikiDir);
    console.log(`✓ Converted ${modified.length} files locally in docs/wiki.`);

    console.log('\n2. Syncing converted alerts to Outline Wiki...');
    await syncOutlineToEmojiBlockquotes();
    process.exit(0);
  }

  console.error(`Unknown argument: ${flag}`);
  process.exit(1);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Critical error:', err);
    process.exit(1);
  });
}

module.exports = {
  convertGitHubAlerts,
  hasGitHubAlerts,
  convertFile,
  convertDirectory,
  syncOutlineToEmojiBlockquotes,
};
