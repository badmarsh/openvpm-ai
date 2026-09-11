import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

// The Stripe SDK's webhook verification is pure offline HMAC — these tests
// exercise the real SDK (no mocks) through our constructWebhookEvent wrapper.
// NOTE: deliberately NOT sk_test_*/whsec_*-shaped — those patterns trip
// GitHub push protection. The SDK never validates key format offline;
// webhook verification only HMACs with the endpoint secret below.
const API_KEY = "offline-stub-stripe-secret-key";
const WEBHOOK_SECRET = "offline-stub-webhook-secret-0123";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function importStripeLib() {
  return import("../stripe");
}

function testEventPayload(): string {
  return JSON.stringify({
    id: "evt_test_123",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_123" } },
  });
}

describe("constructWebhookEvent (Stripe webhook signature verification)", () => {
  it("returns the parsed event for a valid signature", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", API_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
    const { constructWebhookEvent } = await importStripeLib();
    const payload = testEventPayload();
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    const event = await constructWebhookEvent(payload, signature);
    expect(event?.id).toBe("evt_test_123");
    expect(event?.type).toBe("checkout.session.completed");
  });

  it("throws on a tampered body", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", API_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
    const { constructWebhookEvent } = await importStripeLib();
    const payload = testEventPayload();
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    await expect(
      constructWebhookEvent(`${payload} `, signature),
    ).rejects.toThrow(/signature/i);
  });

  it("throws on a signature minted with the wrong secret", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", API_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
    const { constructWebhookEvent } = await importStripeLib();
    const payload = testEventPayload();
    const forged = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "offline-stub-attacker-secret-9999",
    });
    await expect(constructWebhookEvent(payload, forged)).rejects.toThrow(
      /signature/i,
    );
  });

  it("throws on a garbage signature", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", API_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
    const { constructWebhookEvent } = await importStripeLib();
    await expect(
      constructWebhookEvent(testEventPayload(), "not-a-valid-signature"),
    ).rejects.toThrow();
  });

  it("returns null when the webhook secret is not configured (fail-closed)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", API_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const { constructWebhookEvent } = await importStripeLib();
    const payload = testEventPayload();
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    await expect(constructWebhookEvent(payload, signature)).resolves.toBeNull();
  });

  it("returns null when the Stripe client is not configured (fail-closed)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
    const { constructWebhookEvent } = await importStripeLib();
    const payload = testEventPayload();
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    await expect(constructWebhookEvent(payload, signature)).resolves.toBeNull();
  });
});
