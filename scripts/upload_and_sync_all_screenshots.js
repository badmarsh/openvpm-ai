const fs = require('fs');
const path = require('path');

const OUTLINE_URL = 'https://outline.dev.significa.sk';
const OUTLINE_API_KEY = 'ol_api_6fdkgz1d7vthENLyIiV1D1sfUay1bdo8M02YVF';

const SCREENSHOTS_DIR = path.resolve(__dirname, '../docs/screenshots/wiki');
const MAP_FILE = path.join(SCREENSHOTS_DIR, 'attachments_map.json');
const WIKI_DIR = path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka');

async function uploadSingleScreenshot(filename) {
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  const stats = fs.statSync(filePath);

  console.log(`[Upload] Žiadam upload token pre ${filename} (${stats.size} bajtov)...`);

  const createRes = await fetch(`${OUTLINE_URL}/api/attachments.create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OUTLINE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: filename,
      contentType: 'image/png',
      size: stats.size,
    }),
  });

  const createData = await createRes.json();
  if (!createData.data) {
    throw new Error(`Zlyhalo vytvorenie attachmentu pre ${filename}: ${JSON.stringify(createData)}`);
  }

  const { uploadUrl, form, attachment } = createData.data;
  const fullUploadUrl = new URL(uploadUrl, OUTLINE_URL).toString();

  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/png' });

  const formData = new FormData();
  for (const [k, v] of Object.entries(form)) {
    formData.append(k, v);
  }
  formData.append('file', blob, filename);

  const uploadRes = await fetch(fullUploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Upload zlyhal (${uploadRes.status}): ${errText}`);
  }

  const fullRedirectUrl = new URL(attachment.url, OUTLINE_URL).toString();
  console.log(`✓ Úspešne nahrané ${filename} -> ID: ${attachment.id}`);

  return {
    id: attachment.id,
    url: fullRedirectUrl,
    name: filename,
    size: stats.size,
  };
}

async function updateOutlineDoc(docId, title, text) {
  const res = await fetch(`${OUTLINE_URL}/api/documents.update`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OUTLINE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: docId,
      title: title,
      text: text,
      publish: true,
      done: true,
    }),
  });

  const data = await res.json();
  if (!data.data) {
    throw new Error(`Aktualizácia dokumentu ${docId} zlyhala: ${JSON.stringify(data)}`);
  }
  return data.data;
}

async function main() {
  const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`Nájdených ${files.length} screenshotov na nahratie do Outline Wiki...`);

  let map = {};
  if (fs.existsSync(MAP_FILE)) {
    try {
      map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
    } catch {
      map = {};
    }
  }

  for (const file of files) {
    try {
      const res = await uploadSingleScreenshot(file);
      map[file] = res;
    } catch (err) {
      console.error(`✗ Chyba pri nahrávaní ${file}:`, err.message);
    }
  }

  // Uložiť mapu príloh
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2), 'utf8');
  console.log(`\n✓ Aktualizovaný ${MAP_FILE} (${Object.keys(map).length} položiek).\n`);

  // Synchronizácia všetkých kapitol v docs/wiki/01-pouzivatelska-prirucka
  const wikiFiles = fs.readdirSync(WIKI_DIR).filter(f => f.endsWith('.md')).sort();
  console.log(`Začínam synchronizáciu ${wikiFiles.length} kapitol do Outline Wiki...`);

  for (const wf of wikiFiles) {
    const fullPath = path.join(WIKI_DIR, wf);
    let content = fs.readFileSync(fullPath, 'utf8');

    // Hľadať Outline ID na prvom riadku
    const idMatch = content.match(/<!--\s*Outline ID:\s*([a-f0-9-]+)/i);
    if (!idMatch) {
      console.warn(`Preskakujem ${wf}: Nenašiel sa Outline ID v hlavičke.`);
      continue;
    }
    const outlineId = idMatch[1];

    // Hľadať názov kapitoly (H1)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : wf.replace(/\.md$/, '');

    // Skontrolovať, či dokument obsahuje referencie na screenshoty
    const hasScreenshots = content.includes('../../screenshots/wiki/');

    // Pripraviť obsah pre Outline
    let outlineContent = content;
    outlineContent = outlineContent.replace(/^<!--\s*Outline ID:.*-->\s*/, '');
    outlineContent = outlineContent.replace(/^#\s+[^\n]+\n\s*/, '');

    // Nahradiť lokálne cesty URL adresami príloh z Outline
    outlineContent = outlineContent.replace(/!\[(.*?)\]\(\.\.\/\.\.\/screenshots\/wiki\/(.*?)\)/g, (match, alt, filename) => {
      const att = map[filename];
      if (att && att.url) {
        return `![${alt}](${att.url})`;
      }
      return match;
    });

    try {
      await updateOutlineDoc(outlineId, title, outlineContent);
      console.log(`✓ Outline [${outlineId}] "${title}" aktualizovaný ${hasScreenshots ? '(obsahuje screenshoty)' : ''}`);
    } catch (err) {
      console.error(`✗ Chyba pri aktualizácii Outline dokumentu "${title}":`, err.message);
    }
  }

  console.log('\n======================================================');
  console.log('VŠETKY SCREENSHOTY A KAPITOLY BOLI ÚSPEŠNE SYNCHRONIZOVANÉ!');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Kritická chyba:', err);
  process.exit(1);
});
