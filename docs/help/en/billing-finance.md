# Billing & Finance

This page explains how to manage invoices, record payments, operate the e-Kasa fiscal cash register, configure your subscription, and export accounting data in OpenVPM AI.

---

## 1. Invoicing

Go to **Billing** (`/billing`) to access all invoices. To create a new invoice, click **New Invoice**, select a client, and add service or product line items. Line items can be typed manually or pulled from your service catalogue (configured in **Settings**). Save the invoice to commit it as an open draft.

You can edit any open invoice at any time — change quantities, prices, or line items before a payment is recorded. Once fully paid, an invoice is locked.

To void an invoice, open it and click **Void**. This action is restricted to **admin** and **veterinarian** roles. A voided invoice is retained in the system for audit purposes and cannot be deleted.

---

## 2. Payments

To mark an invoice as paid, open it and click **Record Payment**. Supported payment methods are:

| Method | Description |
|---|---|
| **Cash** | Recorded manually; triggers e-Kasa receipt if configured |
| **Card (Stripe)** | In-person card or online Stripe Checkout |
| **Bank Transfer** | Manual reconciliation; no automatic e-Kasa receipt |

**Split payments** allow you to record multiple partial payments against a single invoice — useful when a client pays part cash and part card. Each payment leg is logged separately.

To let a client pay online, open the invoice detail page and use **Send Stripe Link** to email or copy a Stripe Checkout URL to the client.

---

## 3. e-Kasa (Fiscal Cash Register)

Slovak law (**Zakon c. 289/2008 Z. z.** on the use of electronic cash registers) requires that every cash and card payment made to a business is fiscally recorded and a receipt issued. OpenVPM AI integrates with the e-Kasa system operated by Financna sprava SR.

### Setup

Configure e-Kasa at **Settings → e-Kasa** (`/settings/ekasa`). You will need to enter your tax identification, cash register identity (DKP), and connection details for your hardware.

Supported hardware:

- **FiskalPRO** — connected over LAN or REST API
- **VRP2** — cloud-based virtual cash register

### Issuing a Receipt

After recording a **Cash** or **Card** payment on an invoice, OpenVPM AI automatically sends the transaction to the fiscal device and attaches the returned e-Kasa UID to the invoice. Receipts are issued in real time. **Bank Transfer** payments do not generate an e-Kasa receipt.

VAT rates supported:

| Code | Rate |
|---|---|
| `ZERO` | 0 % |
| `REDUCED_5` | 5 % |
| `REDUCED` | 10 % |
| `REDUCED_19` | 19 % |
| `STANDARD_23` | 23 % |

### Daily Closure

Perform the mandatory daily Z-report closure from **Settings → e-Kasa**. The closure totals all transactions for the day and transmits the summary to Financna sprava SR. This must be completed each business day before midnight.

### Voiding a Receipt

To void a previously issued receipt, open the original invoice, click **Void Receipt**, and confirm. You must provide the original e-Kasa UID. This action is restricted to **admin** and **veterinarian** roles.

### Offline Resilience

If the fiscal device or internet connection is unavailable, OpenVPM AI queues transactions locally with status `OFFLINE_STORED`. The queue holds up to **48 hours** of transactions. On reconnection, all queued receipts are automatically submitted in order. Do not perform a daily closure while the queue is pending — wait for the auto-sync to complete first.

> [!IMPORTANT]
> **Integration status**: The e-Kasa driver is implemented and tested with FiskalPRO and VRP2 hardware. Formal certification with Financna sprava SR is currently in progress. Your receipts will comply with e-Kasa format once certification completes.

---

## 4. Subscription & Plans

Your practice subscription is managed under **Settings → Billing** (`/settings`). From there you can view your current plan, upgrade, and manage payment details via Stripe Connect, which also links your bank account for online client payments.

Certain features — such as advanced reporting — are gated by plan tier. If a feature is unavailable, your plan details page will indicate the required plan.

---

## 5. Accounting Exports

Export a full ledger of invoices and payments as **CSV** from **Settings → Data** (`/settings`). The CSV export preserves all field values exactly as stored.

> [!WARNING]
> **PDF export — diacritics warning**: PDF exports pass through a sanitiser that strips Slovak diacritics (c→c, s→s, a→a). If your invoices or client records contain Slovak characters, use **CSV export** to preserve them exactly. Do not rely on PDF for archival records containing Slovak text.

---

Need help? Email [jurkemik@significa.sk](mailto:jurkemik@significa.sk)
