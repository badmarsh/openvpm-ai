const { apiRequest } = require('C:/Users/marek/.gemini/config/outline-client.js');

async function fixDuplicateEmojis() {
  const collections = await apiRequest('collections.list', { limit: 100 });
  console.log(`Checking ${collections.length} collections for duplicate emojis in titles...`);

  for (const col of collections) {
    console.log(`\n=== Kolekcia: ${col.icon || ''} ${col.name} ===`);
    const docs = await apiRequest('documents.list', { collectionId: col.id, limit: 100 });

    for (const doc of docs) {
      // Strip leading emojis and spaces from title
      const cleanTitle = doc.title.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').trim();
      if (cleanTitle !== doc.title) {
        console.log(`Opravujem: "${doc.title}" -> "${cleanTitle}" (ikona ostáva: ${doc.icon || 'žiadna'})`);
        await apiRequest('documents.update', {
          id: doc.id,
          title: cleanTitle,
          icon: doc.icon,
          done: false,
        });
        console.log(`✓ Aktualizované: ${cleanTitle}`);
      } else {
        console.log(`✓ OK: ${doc.title} (${doc.icon || ''})`);
      }
    }
  }

  console.log('\nHotovo! Všetky duplicitné emoji v titulkoch boli odstránené.');
}

fixDuplicateEmojis().catch(err => {
  console.error('Chyba:', err);
  process.exit(1);
});
