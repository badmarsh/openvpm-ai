# Statutory Compliance

OpenVPM helps your practice meet Slovak veterinary law obligations. Navigate
to **Statutory** (`/statutory`) in the sidebar to access all compliance
registers and reporting tools.

> **Roles**: Admin and Veterinarian have full access. Technician and Front
> Desk have read-only access to most registers. Controlled substances are
> restricted to Admin and Veterinarian only.

---

## 1. Legislative framework

The statutory module covers obligations under:

- **Act No. 39/2007 Z. z.** (State Veterinary Care Act) — treatment diary,
  rabies register, withdrawal periods, CRSZ, KVEPIS reporting
- **Act No. 139/1998 Z. z.** (Narcotic and Psychotropic Substances Act) —
  controlled substance register with immutable audit ledger
- **EU Regulation 2019/6** (Veterinary Medicinal Products) — withdrawal
  period documentation for food-producing animals

The system maintains the following statutory registers:

| Register | Slovak name | Legal basis |
|---|---|---|
| Rabies register | Kniha besnoty | Zákon 39/2007 |
| Treatment diary | Kniha ošetrení | Zákon 39/2007 |
| Euthanasia register | Evidencia eutanázií | Zákon 39/2007 |
| Controlled substances ledger | Kniha OPL | Zákon 139/1998 |
| Withdrawal periods | Ochranné lehoty | Zákon 39/2007, EU 2019/6 |
| Carcass disposal | Register likvidácie mŕtvych zvierat | Zákon 39/2007 |

---

## 2. KVEPIS submission workflow

KVEPIS is the ŠVPS SR veterinary data reporting system. OpenVPM generates
an XSD-validated XML export of your monthly ambulatory book and disease
notifications, validated against the official ŠVPS SR schema.

**To export**:
1. Go to **Statutory → KVEPIS** (`/statutory/kvepis`)
2. Select the reporting month
3. Click **Validate & Export XML** — the system validates data against the
   official XSD schema and reports any errors before export
4. Download the XML file and upload it manually through the ŠVPS SR portal

> ⚠️ **Current status**: XML generation and XSD validation are fully
> implemented. **Direct automated submission** (B2G REST API) to ŠVPS SR
> is planned for **v0.7**, pending assignment of production integration
> credentials from ŠVPS SR. Until then, manual upload of the exported XML
> to the ŠVPS SR portal is required.

---

## 3. Rabies management (Kniha besnoty)

Every rabies vaccination must be recorded. The system automatically tracks
the **3-day notification window** to your Regional Veterinary and Food
Administration (RVPS).

**Workflow**:
1. Open the patient record and go to **Vaccinations**
2. Record the rabies vaccine (date, batch number, manufacturer)
3. The statutory module creates an RVPS notification entry automatically
4. View all pending and completed notifications at **Statutory → Rabies**

The rabies register shows vaccination date, notification deadline, RVPS
submission status, and the attending veterinarian's signature.

> ⚠️ **Sympathy Flow safety note**: If the vaccinated animal is
> subsequently recorded as deceased or euthanized, all automated reminders
> and marketing for that patient are permanently suppressed. This is a
> mandatory system behaviour, not a user setting.

---

## 4. Withdrawal periods (Ochranné lehoty)

For food-producing animals, every administered medication must have its
withdrawal period documented. Go to **Statutory → Withdrawal Periods**.

**To record a withdrawal period**:
1. Click **Add withdrawal period**
2. Enter: medication name, batch number (šarža), animal type, farm CEHZ
   code (6-digit, validated automatically), administration date
3. Enter the withdrawal period in days (meat and/or milk separately)
4. The system calculates and displays the `Safe until` date

Active withdrawal periods appear highlighted in the patient record. The
system does not automatically block slaughter — it is an information and
documentation tool only.

> ⚠️ **Accuracy requirement**: Withdrawal period entries are not legally
> binding based on AI suggestions alone. Always verify withdrawal periods
> against the product's official Summary of Product Characteristics (SPC).
> The veterinarian is legally responsible for the accuracy of entries.

---

## 5. CRSZ & PetPass

Register companion animals in the Central Register of Small Animals (CRSZ)
via **Statutory → CRSZ**.

**Features**:
- **Microchip validation**: ISO 11784/11785 (15-digit) format enforced
- **Registration confirmation**: Generate the official registration
  certificate for the owner
- **Batch KVL SR export**: Select multiple animals and export to KVL SR
  as CSV or XML (for batch submission)
- **PetPass travel documents**: Generate travel documentation for animals
  crossing EU borders

---

## 6. Carcass disposal register

Mandatory recording of deceased animals submitted for rendering or safe
disposal. Go to **Statutory → Carcass Disposal**.

**To record a disposal**:
1. Click **New carcass disposal entry**
2. Select the patient, enter the death/euthanasia date, weight, and
   the rendering facility name
3. Record the disposal date and collection reference
4. Save — the entry is added to the SNHRA reporting register

SNHRA reporting forms are generated from these records for submission to
the State Veterinary Authority.

---

## 7. Current limitations

Be aware of the following known limitations as of v0.6:

| Area | Status |
|---|---|
| KVEPIS direct B2G submission | Not yet available — XML export only; live REST planned v0.7 |
| ÚPVS / Slovensko.sk production sandbox | Not yet assigned (Q1 2027) |
| DICOM full PACS (X-ray/CT direct connection) | v1.0 roadmap — current imaging is file upload + AI analysis |
| Real production KVEPIS submissions | None yet — simulation/testing only |
| Controlled substance AI prefill | ZERO by design — all entries manual |
| Live laboratory API connectors | Parser exists; live API deferred to v0.7 |

---

Need help? Email [jurkemik@significa.sk](mailto:jurkemik@significa.sk) and a real
person will answer.
