# OpenVPM AI — Clinical Model Cards & AI Governance Pack

Tento dokument definuje zamýšľané použitie, limitácie, bezpečnostné mechanizmy a etické hranice umelých inteligencií integrovaných do OpenVPM AI v súlade s nariadením **EÚ AI Act (Nariadenie EP a Rady 2024/1689)** a etickým kódexom Komory veterinárnych lekárov SR.

---

## 1. Zoznam Používaných Modelov a Účel

| Modul | Primárny Model | Fallback Model | Účel a Klinická Funkcia |
| :--- | :--- | :--- | :--- |
| **Voice SOAP Dictation** | Whisper v3 Large / Gemini 1.5 Flash | Deepgram Nova-2 | Prepis rozhovoru lekára s majiteľom do štruktúrovaného SOAP záznamu (Subjective, Objective, Assessment, Plan). |
| **Medical Imaging** | Gemini 1.5 Pro Vision | Claude 3.5 Sonnet | Predbežná detekcia fraktúr, kardiomegálie a pľúcnych infiltrátov na RTG snímkach; lokalizácia patológií. |
| **Clinical Decision Support** | Claude 3.5 Sonnet | OpenAI GPT-4o | Návrhy diferenciálnej diagnostiky, kontrola dávkovania liečiv podľa hmotnosti a overenie liekových interakcií. |
| **Discharge & Client Comms**| Claude 3.5 Haiku | Gemini 1.5 Flash | Preformulovanie lekárskej správy do zrozumiteľnej reči pre majiteľa, pokyny k domácej starostlivosti. |

---

## 2. Hard Boundaries — Čo AI NIKDY Nesmie Robiť

Tieto pravidlá sú **technicky vynucované na úrovni kódu (Safety Gates)** a žiadna výzva (prompt) ani používateľský vstup ich nemôže obísť:

1. **ZÁKAZ AUTONÓMNEHO PREDPISU A VÝDAJA LIEKOV:**
   - AI nesmie nikdy vydať, schváliť ani elektronicky podpísať lekársky predpis (recept) ani e-recept.
   - Každý liek navrhnutý AI vyžaduje explicitné potvrdenie lekára s platnou KVL registráciou.
2. **ZÁKAZ PRIAMEHO STANOVENIA DIAGNÓZY MAJITEĽOVI:**
   - AI nesmie priamo komunikovať s majiteľom zvieraťa (cez portál alebo SMS) bez predchádzajúcej autorizácie veterinárnym lekárom.
   - Všetky správy generované AI sú v stave `DRAFT` a odosielajú sa až po stlačení tlačidla lekárom.
3. **ZÁKAZ IGNOROVANIA DRUHOVEJ TOXICITY (Species Contraindication Gate):**
   - Systém má hardcoded pravidlá pre fatálne druhové toxicity (napr. **Permetrín nesmie byť odporúčaný pre Felidae (mačky)**, **Paracetamol / Acetaminofén nesmie byť odporúčaný pre Felidae a Canidae** bez prísneho toxikologického varovania).
4. **ZÁKAZ MODIFIKÁCIE AUDIT TRAILU A KNIHY OMAMNÝCH LÁTOK:**
   - Žiaden AI agent nemá právo zapisovať, upravovať ani mazať riadky v tabuľkách `controlled_substance_log`, `ext_ai_audit_log` ani `ext_statutory`.
5. **SYMPATICKÝ GATE (Deceased Patient Protection):**
   - V prípade uhynutia alebo eutanázie pacienta AI okamžite blokuje akúkoľvek automatickú marketingovú či pripomienkovú komunikáciu a generuje výhradne kondolenčné znenie.

---

## 3. Retenčná Politika Dát a Promotv

- **Audio nahrávky (Voice):** Dočasne ukladané v privátnom S3 buckete (šifrované AES-256). **Automaticky zmazané do 24 hodín** od vygenerovania SOAP poznámky (GDPR compliance).
- **Klinické prompty a kontext:** Ukladané len v pamäti počas trvania relácie. Do externých LLM API odchádzajú anonymizované dáta (bez rodných čísel a priezvisk majiteľov, pokiaľ to nie je nevyhnutné).
- **Zmluva so subprocesormi (Zero Data Retention):** Poskytovatelia API (Anthropic, Google Cloud) majú zakázané trénovať svoje modely na dátach odosielaných z inštancie OpenVPM AI.

---

## 4. Dohľadateľnosť Zdrojov (Traceability & Retrieval)

Všetky klinické odporúčania AI zahŕňajú citácie autoritatívnych veterinárnych zdrojov:
- Databáza registrovaných veterinárnych liečiv **ŠÚKL SR** a **ÚŠKVBL SR**.
- **Plumb's Veterinary Drug Handbook** (štandard dávkovania pre malé zvieratá).
- **BSAVA** (British Small Animal Veterinary Association) guidelines.
- **ACVIM** (American College of Veterinary Internal Medicine) konsenzuálne stanoviská.
