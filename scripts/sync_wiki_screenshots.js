const fs = require('fs');
const path = require('path');

const OUTLINE_URL = 'https://outline.dev.significa.sk';
const OUTLINE_API_KEY = 'ol_api_6fdkgz1d7vthENLyIiV1D1sfUay1bdo8M02YVF';

const mapFile = path.resolve(__dirname, '../docs/screenshots/wiki/attachments_map.json');
const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));

const chapters = [
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/1. Začíname s OpenVPM AI.md'),
    outlineId: 'ba969e88-27b4-4d4f-a2ea-16fcd4d02e02',
    title: '1. Začíname s OpenVPM AI',
    edits: [
      {
        target: '4. Po prihlásení sa zobrazí denný prehľad ambulancie.\n\n> [!NOTE]',
        replacement: '4. Po prihlásení sa zobrazí denný prehľad ambulancie.\n\n![Prihlasovacia obrazovka OpenVPM AI](../../screenshots/wiki/01-01-prihlasenie.png)\n\n> [!NOTE]'
      },
      {
        target: 'stlačte klávesovú skratku **Cmd + K** (macOS) alebo **Ctrl + K** (Windows).\n\n\n---',
        replacement: 'stlačte klávesovú skratku **Cmd + K** (macOS) alebo **Ctrl + K** (Windows).\n\n![Rýchle vyhľadávanie v celom systéme cez Cmd + K / Ctrl + K](../../screenshots/wiki/01-03-rychle-vyhladavanie-cmd-k.png)\n\n\n---'
      },
      {
        target: 'Možnosť prepínania denného, týždenného a stĺpcového zobrazenia pre jednotlivých lekárov.\n2. **Príjem pacienta',
        replacement: 'Možnosť prepínania denného, týždenného a stĺpcového zobrazenia pre jednotlivých lekárov.\n\n![Denný harmonogram a plánovanie návštev](../../screenshots/wiki/01-02-denny-harmonogram.png)\n\n2. **Príjem pacienta'
      },
      {
        target: 'Pripravený na prepustenie*.\n4. **Ukončenie návštevy:**',
        replacement: 'Pripravený na prepustenie*.\n\n![Hospitalizačná a ordinačná tabuľa ambulancie (Whiteboard)](../../screenshots/wiki/01-04-whiteboard-ambulancie.png)\n\n4. **Ukončenie návštevy:**'
      }
    ]
  },
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/2. Kartotéka a zdravotné záznamy.md'),
    outlineId: 'b90a6f85-2629-4502-955c-97515c3f40ef',
    title: '2. Kartotéka a zdravotné záznamy',
    edits: [
      {
        target: 'číslo PetPasu.\n* **Profil pacienta:**',
        replacement: 'číslo PetPasu.\n\n![Kartotéka a zoznam pacientov](../../screenshots/wiki/02-01-zoznam-pacientov.png)\n\n* **Profil pacienta:**'
      },
      {
        target: 'výstražnou farbou.\n\n\n---',
        replacement: 'výstražnou farbou.\n\n![Karta pacienta a profil s anamnézou](../../screenshots/wiki/02-02-profil-pacienta.png)\n\n\n---'
      },
      {
        target: 'odporúčania pre majiteľa.\n\n\n---',
        replacement: 'odporúčania pre majiteľa.\n\n![Klinický záznam a SOAP protokol](../../screenshots/wiki/02-03-soap-klinicky-zaznam.png)\n\n\n---'
      },
      {
        target: 'digitálneho očkovacieho preukazu v mobilnom klientskom portáli.\n\n> [!IMPORTANT]',
        replacement: 'digitálneho očkovacieho preukazu v mobilnom klientskom portáli.\n\n![Očkovací plán a preventívna starostlivosť pacienta](../../screenshots/wiki/02-04-ockovania-preukaz.png)\n\n> [!IMPORTANT]'
      }
    ]
  },
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/3. Fakturácia a e-Kasa.md'),
    outlineId: '90e22e3e-c431-4ef3-b6e0-a8e62febd202',
    title: '3. Fakturácia a e-Kasa',
    edits: [
      {
        target: 'dôvodu pre audit.\n\n\n---',
        replacement: 'dôvodu pre audit.\n\n![Vystavenie dokladu a položkový rozpis faktúry](../../screenshots/wiki/03-01-vystavenie-uctu.png)\n\n\n---'
      },
      {
        target: 'dokladu (UID).\n\n> [!WARNING]',
        replacement: 'dokladu (UID).\n\n![Prehľad e-Kasa dokladov a stav fiškálnej pokladnice](../../screenshots/wiki/03-02-ekasa-prehlad.png)\n\n> [!WARNING]'
      }
    ]
  },
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/4. Sklad a lekáreň.md'),
    outlineId: 'dce9ab2d-f1c2-4ff4-bb66-fb21029bd07a',
    title: '4. Sklad a lekáreň',
    edits: [
      {
        target: 'Henry Schein**.\n\n\n---',
        replacement: 'Henry Schein**.\n\n![Skladové hospodárstvo, lieky, šarže a exspirácie](../../screenshots/wiki/04-01-skladove-zasoby.png)\n\n\n---'
      },
      {
        target: 'vedome zadať licencovaný veterinárny lekár!\n\n\n---',
        replacement: 'vedome zadať licencovaný veterinárny lekár!\n\n![Digitálna kniha omamných a psychotropných látok (OPL)](../../screenshots/wiki/04-02-kniha-opl-narkotika.png)\n\n\n---'
      }
    ]
  },
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/5. Legislatíva a štátne hlásenia.md'),
    outlineId: '1e7538c3-415c-43e7-9842-48527ff5990c',
    title: '5. Legislatíva a štátne hlásenia',
    edits: [
      {
        target: 'registrácii zvierat.\n\n\n---',
        replacement: 'registrácii zvierat.\n\n![Prehľad štátnych registrov a zákonných hlásení SR](../../screenshots/wiki/05-01-statne-registre-prehlad.png)\n\n\n---'
      }
    ]
  },
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/6. Laboratórium a RTG-Sono.md'),
    outlineId: '9a8dd597-0026-45fa-8284-c47e7016a5d9',
    title: '6. Laboratórium a RTG/Sono',
    edits: [
      {
        target: 'PDF/HL7 rozhranie.\n\n\n---',
        replacement: 'PDF/HL7 rozhranie.\n\n![Laboratórne výsledky, biochémia a hematológia](../../screenshots/wiki/06-01-laboratorne-vysledky.png)\n\n\n---'
      }
    ]
  },
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/7. Tvorba webu kliniky (Website Builder).md'),
    outlineId: 'fa3ec56d-aff1-4d98-8783-a9ad6b48ed1a',
    title: '7. Tvorba webu kliniky (Website Builder)',
    edits: [
      {
        target: 'hlavných nastavení ambulancie.\n\n\n---',
        replacement: 'hlavných nastavení ambulancie.\n\n![Vizuálny editor webstránky kliniky (Website Builder)](../../screenshots/wiki/07-01-website-editor.png)\n\n\n---'
      }
    ]
  },
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/8. Marketingové Štúdio a pripomienky.md'),
    outlineId: '42a0cc57-2041-418f-9ad7-f45b63391eb1',
    title: '8. Marketingové Štúdio a pripomienky',
    edits: [
      {
        target: 'VIP klienti:** Najaktívnejší chovatelia.\n\n\n---',
        replacement: 'VIP klienti:** Najaktívnejší chovatelia.\n\n![Marketingové štúdio a multikanálové kampane](../../screenshots/wiki/08-01-marketingove-kampane.png)\n\n\n---'
      }
    ]
  },
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/10. Administrátorské nastavenia kliniky.md'),
    outlineId: '6cd936d0-a577-472e-9c83-76fd507974bc',
    title: '10. Administrátorské nastavenia kliniky',
    edits: [
      {
        target: 'auditnej stope zachované.\n\n> [!NOTE]',
        replacement: 'auditnej stope zachované.\n\n![Správa používateľov kliniky a nastavenie prístupových rolí](../../screenshots/wiki/10-01-sprava-personalu-roly.png)\n\n> [!NOTE]'
      }
    ]
  },
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/11. Finančné a prevádzkové reporty.md'),
    outlineId: '9827e50e-f805-4e2a-bb84-d5b0aba6c729',
    title: '11. Finančné a prevádzkové reporty',
    edits: [
      {
        target: 'veterinárnych diét.\n\n\n---',
        replacement: 'veterinárnych diét.\n\n![Finančný prehľad a dashboard prevádzkových reportov](../../screenshots/wiki/11-01-financny-dashboard.png)\n\n\n---'
      }
    ]
  },
  {
    file: path.resolve(__dirname, '../docs/wiki/01-pouzivatelska-prirucka/14. Prirodzená komunikácia s AI asistentom.md'),
    outlineId: '6f172196-0044-4901-9db6-b18b14215e41',
    title: '14. Prirodzená komunikácia s AI asistentom',
    edits: [
      {
        target: 'pooperačnej starostlivosti.',
        replacement: 'pooperačnej starostlivosti.\n\n![Klinická konzultácia a vyhľadávanie s AI asistentom](../../screenshots/wiki/14-01-ai-sidebar-konzultacia.png)'
      }
    ]
  }
];

async function updateOutlineDoc(id, title, text) {
  const res = await fetch(OUTLINE_URL + '/api/documents.update', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + OUTLINE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: id,
      title: title,
      text: text
    })
  });
  const data = await res.json();
  if (!data.data) {
    throw new Error('Outline update failed: ' + JSON.stringify(data));
  }
  return data.data;
}

(async () => {
  for (const ch of chapters) {
    console.log('Processing:', ch.title);
    let content = fs.readFileSync(ch.file, 'utf8');

    for (const edit of ch.edits) {
      if (!content.includes(edit.target)) {
        console.warn('WARN: target not found in ' + ch.file + ':\n' + edit.target.slice(0, 60));
      } else {
        content = content.replace(edit.target, edit.replacement);
      }
    }

    // Save local version
    fs.writeFileSync(ch.file, content, 'utf8');
    console.log('✓ Updated local file:', path.basename(ch.file));

    // Prepare Outline version:
    // 1. Remove Outline ID header comment and H1 heading
    let outlineContent = content;
    outlineContent = outlineContent.replace(/^<!-- Outline ID:.*-->\s*/, '');
    outlineContent = outlineContent.replace(/^#\s+[^\n]+\n\s*/, '');

    // 2. Replace relative image links with Outline attachment redirect URLs
    outlineContent = outlineContent.replace(/!\[(.*?)\]\(\.\.\/\.\.\/screenshots\/wiki\/(.*?)\)/g, (match, alt, filename) => {
      const att = map[filename];
      if (att && att.url) {
        return '![' + alt + '](' + att.url + ')';
      }
      return match;
    });

    // Update in Outline
    try {
      await updateOutlineDoc(ch.outlineId, ch.title, outlineContent);
      console.log('✓ Updated Outline doc [' + ch.outlineId + ']: ' + ch.title);
    } catch (e) {
      console.error('✗ Outline error on ' + ch.title + ':', e.message);
    }
  }

  console.log('\nVšetky kapitoly boli úspešne aktualizované lokálne aj v Outline!');
})();
