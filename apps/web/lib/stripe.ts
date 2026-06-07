import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function createCheckoutSession(data: {
  invoiceId: string;
  amount: number; // in cents
  clientEmail: string;
  clientName: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  currency?: string; // ISO 4217 (lowercase), per the practice's region. Defaults to USD.
}): Promise<{ url: string | null } | null> {
  if (!stripe) {
    console.log("[Stripe] No API key configured, skipping checkout session", data);
    return null;
  }
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: data.clientEmail,
    line_items: [{
      price_data: {
        currency: (data.currency ?? "usd").toLowerCase(),
        product_data: { name: data.description },
        unit_amount: data.amount,
      },
      quantity: 1,
    }],
    metadata: { invoiceId: data.invoiceId },
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
  });
  return { url: session.url };
}

export async function constructWebhookEvent(
  body: string,
  signature: string,
): Promise<Stripe.Event | null> {
  if (!stripe) return null;
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}

// ── Hosted-SaaS subscriptions (separate surface from client invoicing) ──────

/**
 * Create a Checkout Session for a recurring plan subscription. The practiceId is
 * stamped on both the session and the subscription metadata so the webhook can
 * map the resulting subscription back to a practice.
 */
export async function createSubscriptionCheckoutSession(data: {
  priceId: string;
  practiceId: string;
  customerId?: string | null;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null } | null> {
  if (!stripe) {
    console.log("[Stripe] No API key configured, skipping subscription checkout");
    return null;
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: data.priceId, quantity: 1 }],
    ...(data.customerId
      ? { customer: data.customerId }
      : { customer_email: data.customerEmail ?? undefined }),
    client_reference_id: data.practiceId,
    metadata: { practiceId: data.practiceId },
    subscription_data: { metadata: { practiceId: data.practiceId } },
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
  });
  return { url: session.url };
}

/** Create a Stripe Billing Portal session so a practice can manage its plan. */
export async function createBillingPortalSession(data: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string } | null> {
  if (!stripe) return null;
  const session = await stripe.billingPortal.sessions.create({
    customer: data.customerId,
    return_url: data.returnUrl,
  });
  return { url: session.url };
}

/** Verify a subscription-webhook signature using its dedicated endpoint secret. */
export async function constructSubscriptionWebhookEvent(
  body: string,
  signature: string,
): Promise<Stripe.Event | null> {
  if (!stripe) return null;
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET!,
  );
}

export { stripe };
