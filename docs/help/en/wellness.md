# Wellness Plans

Wellness plans let you offer clients a bundled monthly or annual
preventive care subscription. Plans reduce the cost of routine care
for clients while providing your practice with predictable recurring
revenue.

> **Roles**: Admin and Front Desk create and manage plans and enrolments.
> All clinical roles can view a patient's wellness status.

---

## 1. Plan overview

A wellness plan is a named package with a monthly or annual price that
includes a defined set of redeemable services (e.g. one annual exam,
two vaccines, one dental check per year).

Admins create and configure plans in **Settings → Wellness Plans**. Each
plan has:

- **Name and description** — visible to staff and clients
- **Price** — monthly or annual billing cycle
- **Included services** — the list of services a client can redeem under
  the plan, with quantities per billing period

Plans are activated and made available for enrolment once saved.

---

## 2. Enrolling a patient

To enrol a patient in a wellness plan:

1. Open the patient record
2. Go to the **Wellness** tab
3. Click **Enrol in plan**
4. Select an active plan from the list
5. Confirm the enrolment start date
6. Click **Enrol**

Billing starts on the enrolment date. The patient's Wellness tab shows:

- Plan name and status (active, cancelled, paused)
- Next billing date
- Redeemable services remaining this cycle

---

## 3. Redeeming services

When a plan service is performed (e.g. the patient's included annual exam):

1. Open the patient encounter or invoice
2. Add the service as a line item
3. The system detects it is covered by the active plan and marks it
   **Redeemed**
4. The redemption is recorded against the plan's allowance for this cycle

Redeemed services are shown in the patient's Wellness tab. Services not
used in a billing cycle do not roll over to the next cycle unless
configured to do so.

---

## 4. Billing workflow

Wellness plan invoices are generated automatically on each billing cycle
date. The system:

1. Calculates the next billing date based on the enrolment date and cycle
2. Creates an invoice for the plan fee
3. Attempts to charge via Stripe if the client has a payment method on file
4. Shows the invoice in **Billing** for manual review and collection if
   no automatic payment is configured

Review generated wellness invoices and collect payment as you would any
other invoice.

---

## 5. Cancellation

To cancel a patient's enrolment:

1. Open the patient record and go to the **Wellness** tab
2. Click **Cancel enrolment**
3. Confirm the cancellation

Cancellation stops all future billing immediately. Services already
redeemed in the current cycle are not refunded automatically. Handle any
credit or partial refund manually via an invoice adjustment or credit note.

---

Need help? Email [jurkemik@significa.sk](mailto:jurkemik@significa.sk) and a real
person will answer.
