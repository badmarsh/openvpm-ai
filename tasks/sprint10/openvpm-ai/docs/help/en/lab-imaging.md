# Lab Results & Medical Imaging

OpenVPM connects your in-house analysers, manages your lab inbox, and
provides AI-assisted interpretation of medical images.

---

## 1. Lab results

### Viewing results

Open **Lab Results** (`/lab-results`) to see all results across your
practice, or open any patient and navigate to their **Lab** tab for their
individual history. Reference ranges for dogs and cats are built in —
out-of-range values are flagged with colour-coded indicators automatically.

### Automatic analyser import

Results are automatically imported from the following connected in-house
analysers:

| Analyser | Type | Parameters |
|---|---|---|
| IDEXX Catalyst One / Dx | Biochemistry | ALT, AST, ALP, GGT, UREA, CREA, GLU, TBIL, TP, ALB, Ca, PHOS, Cholesterol, Amylase, Lipase |
| IDEXX ProCyte Dx / LaserCyte | Haematology | WBC, RBC, HGB, HCT, MCV, MCH, MCHC, PLT, Differential |
| Fuji Dri-Chem NX500 / NX700 | Dry chemistry | ALT, ALP, BUN, CRE, GLU, TP, ALB, TBIL, IP, Ca, Mg, CRP |
| Mindray BC-Vet (BC-2800/30) | Haematology | 3-part / 5-part small animal haematology |

**Coming soon (v0.7)**: scil Vet abc Plus (RS-232/CSV haematology connector).

Results from Laboklin SK and Synlab SK external reference labs are also
supported via HL7/PDF import.

### Lab inbox (safety queue)

The **Lab Inbox** (`/inbox`) is your clinic-wide safety queue. It shows all
results that are waiting for review. From the inbox you can:

- **Review a result** — mark it reviewed and add your interpretation note
- **Assign follow-up** — assign a task to a team member (e.g. "call owner")
- **Mark entered in error** — if a result is a duplicate, typo, or
  attached to the wrong patient, mark it "Entered in error". The original
  evidence remains visible but is removed from active queues and trends.
  Use **Create replacement** to create a linked, corrected entry.

A result is not considered complete until it has been reviewed and any
required follow-up is assigned.

---

## 2. Medical imaging

### Opening the imaging module

Navigate to **Agent → Imaging** (`/agent/imaging`) to upload and analyse
medical images.

### Uploading images

When uploading a medical image (X-ray, ultrasound, CT, MRI, wound photo):

1. Click **Upload image**
2. Select the patient
3. **Always choose category `imaging`** — this attaches the file to the
   patient's medical imaging record

> ⚠️ **Important**: Medical image uploads do **not** replace the patient's
> profile photo. The category `imaging` stores the file in the separate
> imaging record. If you accidentally use a different category, the image
> may be stored as a general attachment rather than a clinical image.

### AI-assisted interpretation

After upload, click **Analyse** to run AI interpretation on the image. The
system uses a multimodal model to provide a structured interpretation with
a confidence score:

| Badge | Score | Meaning |
|---|---|---|
| 🟢 **High** | ≥ 0.92 | High reliability — suitable for rapid review |
| 🟡 **Medium** | 0.75 – 0.91 | Manual review recommended |
| 🔴 **Low** | < 0.75 | Low reliability — mandatory line-by-line validation |

> ⚠️ **All AI imaging analyses are drafts.** A licensed veterinarian must
> review the interpretation via the **Clinical Review** confirmation screen
> before it is saved to the patient's permanent medical record. The AI
> cannot write directly to the record.

### Current limitations

| Feature | Status |
|---|---|
| Full DICOM PACS (direct X-ray/CT equipment connection) | v1.0 roadmap — not yet available |
| AI imaging analysis | Available — file upload + multimodal AI |
| scil Vet abc Plus RS-232 connector | Coming v0.7 |
| Live IDEXX / Zoetis external API connectors | Parser exists; live API deferred to v0.7 |

---

Need help? Email [jurkemik@significa.sk](mailto:jurkemik@significa.sk) and a real
person will answer.
