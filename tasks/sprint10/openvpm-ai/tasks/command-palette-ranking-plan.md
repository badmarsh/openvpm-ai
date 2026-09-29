# Command Palette Smart Ranking — Implementation Plan

## Problem
When a user types in the command palette (F1 / Cmd+K), Quick Actions and Navigation
items disappear entirely. Only DB search results (patients/clients) are shown.
This means typing "návšteva" or "soap" returns nothing unless a patient/client name
matches. The palette also has no awareness of where the user is in the app.

## Architecture

### File: `apps/web/components/common/command-search.tsx`

This is the only file that needs significant changes. The i18n dictionaries already
have correct SK translations for all Quick Action and Navigation labels.

### Current behaviour
- `shouldFilter={!hasQuery}` — when query is empty, cmdk does its own filtering
  on Command.Item children. When query is non-empty, filtering is OFF.
- When `hasQuery` is true, only `patientResults` and `clientResults` groups render.
  Quick Actions, Navigation, and Appearance groups are gated behind `!hasQuery`.

## Changes

### 1. Show matching Quick Actions & Navigation when typing

When `hasQuery` is true, filter `quickActionItems` and `navigationItems` in JS
against the resolved i18n label (both SK and EN for cross-language matching).
Use a simple case-insensitive `includes` match.

Display matching items in a new group **above** the DB results:
- Group heading: "Akcie" / "Actions"
- Limit to max 5 combined results to keep the list clean

Implementation:
```ts
// Add searchAliases to CommandItemConfig
type CommandItemConfig = {
  ...existing fields...
  searchAliases?: string[];  // extra terms: ["návšteva", "objednať", "termín"]
};

// Filter function
function matchesQuery(item: CommandItemConfig, query: string, t: TFunction): boolean {
  const q = query.toLowerCase().trim();
  const label = t(item.labelKey, item.fallbackLabel).toLowerCase();
  const fallback = item.fallbackLabel.toLowerCase();
  if (label.includes(q) || fallback.includes(q)) return true;
  if (item.searchAliases?.some(a => a.toLowerCase().includes(q))) return true;
  return false;
}

// In render, when hasQuery:
const matchedActions = [...visibleQuickActionItems, ...visibleNavigationItems]
  .filter(item => matchesQuery(item, debouncedSearch, t))
  .slice(0, 5);
```

Render `matchedActions` as a Command.Group before patients/clients groups.

### 2. Context-aware no-query ordering

Use `usePathname()` to detect current page context and prepend relevant
contextual actions to the Quick Actions group when there is no query.

Context rules:
| Route pattern        | Contextual items (prepended)                          |
|---------------------|------------------------------------------------------|
| /clients/:id        | "Nový pacient pre klienta", "Nová návšteva"          |
| /patients/:id       | "Hlasové diktovanie", "Nová návšteva", "Nový SOAP"  |
| /encounters/:id     | "Hlasové diktovanie", "Nová faktúra"                 |
| /schedule           | "Nová návšteva" (boost to top)                       |
| /billing            | "Nová faktúra", "e-Kasa"                             |

Implementation:
```ts
type ContextualAction = CommandItemConfig & { contextOnly?: boolean };

function getContextualActions(pathname: string, t: TFunction): ContextualAction[] {
  // /clients/:uuid
  if (/^\/clients\/[0-9a-f-]{36}$/.test(pathname)) {
    return [
      { labelKey: "commandSearch.ctxNewPatientForClient", fallbackLabel: "New patient for this client",
        href: `/patients/new?clientId=...`, Icon: PawPrint, roles: [...], contextOnly: true },
      // find "newAppointment" from quickActionItems and return it
    ];
  }
  // ... similar for other patterns
}
```

For /clients/:id context, the clientId is in the URL so it can be extracted.
For /patients/:id, the patientId is in the URL.

These contextual actions show at the top of Quick Actions in no-query mode.

### 3. Navigation tiering & Appearance reorder

Split `navigationItems` into two tiers:

**Primary (always visible in no-query):**
- Rozvrh (/schedule)
- Pacienti (/patients) 
- Majitelia (/clients)
- Tabuľa (/whiteboard)
- Fakturácia (/billing)
- Záznamy (/records)

**Secondary (collapsed behind "Zobraziť viac..." toggle):**
- Everything else (Lab, Sklad, Správy, Očkovania, etc.)

**Appearance** group moves to the very end, after Navigation.

### 4. i18n: add search aliases

Add `searchAliases` field to items that have commonly typed SK terms:

| Item              | Aliases                                        |
|-------------------|------------------------------------------------|
| New Appointment   | "návšteva", "objednať", "termín", "objednavka" |
| New SOAP Note     | "soap", "záznam", "diktat", "vysetrenie"       |
| New Invoice       | "faktúra", "účet", "platba"                    |
| New Client        | "klient", "majiteľ", "owner"                   |
| New Patient       | "pacient", "zviera", "pes", "mačka"            |
| Schedule (nav)    | "rozvrh", "kalendár", "objednavky"             |
| Voice Dictation   | "diktovanie", "hlas", "mikrofón", "scribe"     |

These don''t need i18n keys — they''re search-only internal strings.

## i18n changes

### New keys in en.json / sk.json (commandSearch section):
- `headingMatchedActions`: "Actions" / "Akcie"
- `ctxNewPatientForClient`: "New patient for this client" / "Nový pacient pre tohto klienta"
- `ctxVoiceDictation`: "Voice Dictation" / "Hlasové diktovanie"
- `ctxNewSoapNote`: "New SOAP Note for patient" / "Nový SOAP záznam pre pacienta"
- `navShowMore`: "Show more..." / "Zobraziť viac..."
- `navShowLess`: "Show less" / "Zobraziť menej"

## Testing

- Type "náv" → should show "Nová návšteva" action above DB results
- Type "soap" → should show "Nový SOAP záznam" action
- Type "fakt" → should show "Nová faktúra"
- Type "bono" → should show patients first (existing behaviour preserved)
- Open on /clients/:id with no query → first item should be context-aware
- Open on /patients/:id with no query → "Hlasové diktovanie" should be first
- Navigation should show 6 primary items, rest behind toggle
- Appearance should be last group

## Files to modify
1. `apps/web/components/common/command-search.tsx` — main changes
2. `apps/web/messages/en.json` — new commandSearch keys
3. `apps/web/messages/sk.json` — new commandSearch keys

