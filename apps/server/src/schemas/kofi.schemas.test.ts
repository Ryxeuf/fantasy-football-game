import { describe, it, expect } from "vitest";
import {
  kofiWebhookPayloadSchema,
  amountToCents,
} from "./kofi.schemas";

const basePayload = {
  verification_token: "secret-token",
  message_id: "msg-1",
  timestamp: "2026-04-22T10:00:00Z",
  type: "Donation" as const,
  from_name: "Jane",
  message: "Keep it up!",
  amount: "5.00",
  email: "jane@example.com",
  currency: "EUR",
  kofi_transaction_id: "kofi-tx-1",
};

describe("Rule: ko-fi webhook schema", () => {
  describe("kofiWebhookPayloadSchema", () => {
    it("accepts a minimal donation payload", () => {
      const result = kofiWebhookPayloadSchema.safeParse(basePayload);
      expect(result.success).toBe(true);
    });

    it("accepts a subscription payment with tier_name", () => {
      const result = kofiWebhookPayloadSchema.safeParse({
        ...basePayload,
        type: "Subscription",
        is_subscription_payment: true,
        is_first_subscription_payment: true,
        tier_name: "Gold Member",
        amount: "10.00",
      });
      expect(result.success).toBe(true);
    });

    it("accepts a shop order with shop_items", () => {
      const result = kofiWebhookPayloadSchema.safeParse({
        ...basePayload,
        type: "Shop Order",
        shop_items: [{ direct_link_code: "abc123", quantity: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it("rejects when verification_token is missing", () => {
      const { verification_token, ...rest } = basePayload;
      const result = kofiWebhookPayloadSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects an unknown type", () => {
      const result = kofiWebhookPayloadSchema.safeParse({
        ...basePayload,
        type: "Bitcoin",
      });
      expect(result.success).toBe(false);
    });

    it("accepts a null message (anonymous donation)", () => {
      const result = kofiWebhookPayloadSchema.safeParse({
        ...basePayload,
        message: null,
      });
      expect(result.success).toBe(true);
    });

    it("accepts a missing from_name and email", () => {
      const { from_name, email, ...rest } = basePayload;
      const result = kofiWebhookPayloadSchema.safeParse(rest);
      expect(result.success).toBe(true);
    });
  });

  describe("amountToCents", () => {
    it("converts integer amounts", () => {
      expect(amountToCents("5")).toBe(500);
    });

    it("converts decimal amounts with 2 digits", () => {
      expect(amountToCents("5.00")).toBe(500);
      expect(amountToCents("12.50")).toBe(1250);
      expect(amountToCents("0.99")).toBe(99);
    });

    it("rounds half-cent amounts", () => {
      expect(amountToCents("1.995")).toBe(200);
      expect(amountToCents("1.994")).toBe(199);
    });

    it("throws on invalid input", () => {
      expect(() => amountToCents("not-a-number")).toThrow();
      expect(() => amountToCents("-1.00")).toThrow();
    });
  });
});
