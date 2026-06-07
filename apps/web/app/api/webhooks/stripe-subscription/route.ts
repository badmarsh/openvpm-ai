import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@openpims/db/client";
import { practices } from "@openpims/db";
import { constructSubscriptionWebhookEvent } from "@/lib/stripe";
import { tierForStripePrice, normalizeBillingStatus } from "@/lib/billing/plans";
import { alertOps } from "@/lib/alerts";

/**
 * Stripe webhook for hosted-SaaS subscriptions — a SEPARATE endpoint from the
 * client-invoice webhook (different signing secret). Keeps the two Stripe
 * surfaces isolated so neither can spoof the other.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event | null;
  try {
    event = await constructSubscriptionWebhookEvent(body, signature);
  } catch (err) {
    console.error("[Stripe Subscription Webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!event) {
    return NextResponse.json(
      { error: "Webhook verification failed or Stripe not configured" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const practiceId = s.client_reference_id ?? s.metadata?.practiceId ?? null;
        if (practiceId && s.customer) {
          await db
            .update(practices)
            .set({
              stripeCustomerId:
                typeof s.customer === "string" ? s.customer : s.customer.id,
              stripeSubscriptionId:
                typeof s.subscription === "string"
                  ? s.subscription
                  : (s.subscription?.id ?? null),
            })
            .where(eq(practices.id, practiceId));
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const practiceId = sub.metadata?.practiceId;
        if (practiceId) {
          await db
            .update(practices)
            .set({
              subscriptionTier: "free",
              billingStatus: "canceled",
              stripeSubscriptionId: null,
            })
            .where(eq(practices.id, practiceId));
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId =
          typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        if (customerId) {
          await db
            .update(practices)
            .set({ billingStatus: "past_due" })
            .where(eq(practices.stripeCustomerId, customerId));
          await alertOps(
            "Subscription payment failed",
            `Stripe customer ${customerId} had a failed subscription payment; marked past_due.`,
          );
        }
        break;
      }

      default:
        // Ignore other event types.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Stripe Subscription Webhook] handler error:", err);
    await alertOps(
      "Subscription webhook handler error",
      `Event ${event.type} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}

/** Apply a subscription's tier/status/trial to its practice (via metadata.practiceId). */
async function applySubscription(sub: Stripe.Subscription) {
  const practiceId = sub.metadata?.practiceId;
  if (!practiceId) {
    console.warn("[Stripe Subscription Webhook] subscription without practiceId metadata:", sub.id);
    return;
  }
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const tier = tierForStripePrice(priceId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  await db
    .update(practices)
    .set({
      ...(tier ? { subscriptionTier: tier } : {}),
      billingStatus: normalizeBillingStatus(sub.status),
      stripeSubscriptionId: sub.id,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    })
    .where(eq(practices.id, practiceId));
}
