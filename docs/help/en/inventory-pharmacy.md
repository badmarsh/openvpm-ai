# Inventory & Pharmacy

Manage your product stock, controlled substances, and drug dosing at
**Inventory** (`/inventory`). All stock movements are logged with a
timestamp, user, and reason.

> **Roles**: All roles can view inventory. Adjustments require Admin or
> Front Desk. Controlled substances are restricted to Admin and Veterinarian.

---

## 1. Product & stock management

Your product catalogue is the source of truth for everything you dispense
or sell. Each product has:

- **Name, SKU, category** — organise products by type (medication, supply,
  food, etc.)
- **Supplier** — link to a supplier record for reorder tracking
- **Unit price** — used when adding the product to an invoice
- **Lot number & expiry date** — tracked per batch; multiple lots per product
- **Reorder level** — when stock falls to or below this number, the product
  appears in the Attention/Low Stock alerts
- **Pagination** — the product list displays 50 items per page with fast navigation,
  page counter, and automatic reset to page 1 on search or filter change.

**Alert filter**: Use the filter at the top of the Inventory page to view:

| Filter | Shows |
|---|---|
| All | Full catalogue |
| Attention | Approaching reorder level |
| Low stock | At or below reorder level |
| Expired | Past expiry date |
| Expiring soon | Expiring within the configured window |

**Adjusting stock**: Open any product and click **Adjust Quantity**. Enter
the change (positive for receipt, negative for write-off), select a reason
from the dropdown, and save. Every adjustment is logged with your name,
timestamp, and reason.

---

## 2. Controlled substances (Kniha OPL)

Controlled substances — Schedule I/II drugs including ketamine, propofol,
opiates, butorphanol, and fentanyl — are tracked in the separate
**Controlled Substances** register at `/controlled-substances`.

**Access**: Admin and Veterinarian roles only. Front Desk and Technician
roles cannot view or access this register.

**Recording a dispensing**:
1. Open the patient encounter
2. Navigate to the controlled substances section
3. Enter: drug name, quantity used, batch number, patient, and indication
4. Record any waste (unused quantity destroyed), the witness's name, and
   their signature
5. Submit — the entry is written to the immutable audit ledger

**Witness requirement**: Every controlled substance dispensing that involves
wasting requires a second authorised person (Admin or Veterinarian) to
witness and sign.

**Reconciliation**: Periodic stock reconciliation compares physical count
against the ledger. Run a reconciliation from the Controlled Substances
page to identify any discrepancies.

> ⚠️ **Zero AI prefill**: The AI assistant has zero ability to prefill
> any controlled substance fields. All entries are typed manually by a
> licensed veterinarian. This is a mandatory regulatory requirement under
> Zákon č. 139/1998 Z. z.

---

## 3. Drug dosing calculator

The dosing calculator is available within patient records and the encounter
screen. It provides weight-based dose ranges for common veterinary drugs.

**How to use**:
1. Open the patient record or encounter
2. Click **Dosing Calculator**
3. Select the drug from the formulary
4. Enter the patient's weight (kg)
5. Optionally enter the drug concentration (mg/mL) for volume calculation
6. The calculator returns the dose range for the species (canine or feline)

The formulary includes species-specific toxicity guards (e.g. paracetamol
for cats, ivermectin for collies).

> ⚠️ **Clinical decision support only**: The dosing calculator is a
> reference tool. Always verify calculated doses against the drug's official
> Summary of Product Characteristics (SPC). A mandatory disclaimer is
> displayed with every calculation result. The system does not prevent you
> from overriding the calculated dose.

---

## 4. Wholesaler delivery note import

The system automatically parses and imports electronic delivery notes
directly into inventory:

| Wholesaler | Format |
|---|---|
| **Cymedica SK s.r.o.** | CSV (semicolon-delimited) |
| **Pharmos a.s.** | EDI / CSV with ADC/ŠÚKL drug codes |
| **Samohýl SK, s.r.o.** | CSV with EAN codes |
| **Henry Schein SK** | CSV / Tab-delimited |
| **BIOPHARM, s.r.o.** | Standardised CSV with drug codes, lots, and expiries |
| **KOMVET s.r.o.** | Tab-delimited .txt safe parser |
| **SG-Vet s.r.o.** | XML with Slovak tag support (`<polozka>`, `<sarza>`, `<expiracia>`) |
| **SANVET s.r.o. / PHRAMED** | CSV with distributor auto-detection |

Parsed fields include: product code (SKU), name, batch/lot number, expiry date,
quantity, and purchase unit price. The system matches incoming items against existing
products and suggests either updating stock (`update_stock`) or creating a new product (`create_product`).

> 🛑 **Controlled Substances Safety Gate (Act 139/1998 Coll.)**:
> During import, any controlled substance (including Ketamidor, ketamine,
> butorphanol, fentanyl, propofol) is automatically flagged and defaults to
> **Skip** (`skip`). Controlled drugs cannot be automatically added to general
> inventory without explicit manual verification and entry into Kniha OPL by a veterinarian.

Access this feature at **Inventory → Import Delivery Note** (`/inventory/import`).

---

Need help? Email [jurkemik@significa.sk](mailto:jurkemik@significa.sk) and a real
person will answer.
