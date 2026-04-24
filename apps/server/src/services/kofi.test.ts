import { describe, it, expect } from "vitest";
import {
  aggregateSupporterState,
  computeSupporterUpdate,
  extractKofiLinkCode,
  generateKofiLinkCode,
  isSupporter,
  matchKofiPayloadToUser,
  normaliseEmail,
  SUPPORTER_ACTIVE_WINDOW_DAYS,
} from "./kofi";

describe("Rule: kofi service", () => {
  describe("generateKofiLinkCode", () => {
    it("produces codes of the form KFI- + 6 chars", () => {
      const code = generateKofiLinkCode();
      expect(code).toMatch(/^KFI-[0-9A-HJKMNP-TV-Z]{6}$/);
    });

    it("excludes ambiguous characters (I, L, O, U)", () => {
      // 500 draws is enough to surface forbidden chars if present.
      for (let i = 0; i < 500; i += 1) {
        const code = generateKofiLinkCode();
        expect(code.slice(4)).not.toMatch(/[ILOU]/);
      }
    });
  });

  describe("extractKofiLinkCode", () => {
    it("finds a code in a message", () => {
      expect(extractKofiLinkCode("Merci KFI-AB12CD bravo")).toBe("KFI-AB12CD");
    });

    it("is case-insensitive and normalises to uppercase", () => {
      expect(extractKofiLinkCode("kfi-ab12cd")).toBe("KFI-AB12CD");
    });

    it("returns null when no code is present", () => {
      expect(extractKofiLinkCode("plain message")).toBeNull();
      expect(extractKofiLinkCode(null)).toBeNull();
      expect(extractKofiLinkCode(undefined)).toBeNull();
      expect(extractKofiLinkCode("")).toBeNull();
    });

    it("rejects malformed codes (wrong length / forbidden chars)", () => {
      expect(extractKofiLinkCode("KFI-ABCDE")).toBeNull(); // 5 chars
      expect(extractKofiLinkCode("KFI-ABCDEFG")).toBeNull(); // 7 chars
      expect(extractKofiLinkCode("KFI-ILOUAB")).toBeNull(); // forbidden chars
    });
  });

  describe("normaliseEmail", () => {
    it("trims and lowercases", () => {
      expect(normaliseEmail("  Alice@Example.COM  ")).toBe("alice@example.com");
    });

    it("returns null for nullish/empty inputs", () => {
      expect(normaliseEmail(null)).toBeNull();
      expect(normaliseEmail(undefined)).toBeNull();
      expect(normaliseEmail("   ")).toBeNull();
    });
  });

  describe("matchKofiPayloadToUser", () => {
    const candidates = [
      {
        id: "u1",
        email: "alice@example.com",
        kofiLinkCode: "KFI-AB12CD",
        discordUserId: null,
      },
      {
        id: "u2",
        email: "bob@example.com",
        kofiLinkCode: "KFI-EF34GH",
        discordUserId: "111222333444555666",
      },
      {
        id: "u3",
        email: "carol@example.com",
        kofiLinkCode: null,
        discordUserId: "999888777666555444",
      },
    ];

    it("matches by code with priority over email and discord", () => {
      const result = matchKofiPayloadToUser(
        {
          message: "thanks KFI-AB12CD",
          email: "carol@example.com",
          discord_userid: "999888777666555444",
        },
        candidates,
      );
      expect(result).toEqual({ userId: "u1", matchedVia: "code" });
    });

    it("falls back to email when no code present", () => {
      const result = matchKofiPayloadToUser(
        {
          message: "love the game",
          email: "Bob@Example.COM",
          discord_userid: null,
        },
        candidates,
      );
      expect(result).toEqual({ userId: "u2", matchedVia: "email" });
    });

    it("falls back to discord when neither code nor email match", () => {
      const result = matchKofiPayloadToUser(
        {
          message: "love the game",
          email: "stranger@example.com",
          discord_userid: "111222333444555666",
        },
        candidates,
      );
      expect(result).toEqual({ userId: "u2", matchedVia: "discord" });
    });

    it("returns null when nothing matches", () => {
      const result = matchKofiPayloadToUser(
        { message: null, email: "stranger@example.com", discord_userid: null },
        candidates,
      );
      expect(result).toBeNull();
    });

    it("returns null when code is present but does not match any user", () => {
      const result = matchKofiPayloadToUser(
        {
          message: "KFI-ZZZZZZ",
          email: "alice@example.com",
          discord_userid: "111222333444555666",
        },
        candidates,
      );
      // Code match fails → should NOT silently fall back to email/discord:
      // code is a strong claim "this donation belongs to user X", a wrong
      // code means the donor made a mistake, not that we should auto-attach.
      expect(result).toBeNull();
    });

    it("ignores discord_userid when it matches no candidate", () => {
      const result = matchKofiPayloadToUser(
        {
          message: null,
          email: "stranger@example.com",
          discord_userid: "000000000000000000",
        },
        candidates,
      );
      expect(result).toBeNull();
    });
  });

  describe("computeSupporterUpdate", () => {
    const NOW = new Date("2026-04-22T12:00:00Z");

    it("extends supporter status on a subscription payment", () => {
      const update = computeSupporterUpdate(
        {
          amount: "10.00",
          currency: "EUR",
          is_subscription_payment: true,
          tier_name: "Gold Member",
        },
        NOW,
      );

      expect(update.supporterTier).toBe("Gold Member");
      expect(update.currency).toBe("EUR");
      expect(update.amountCentsDelta).toBe(1000);
      expect(update.supporterActiveUntil).not.toBeNull();
      const deltaDays =
        (update.supporterActiveUntil!.getTime() - NOW.getTime()) /
        (1000 * 60 * 60 * 24);
      expect(deltaDays).toBeCloseTo(SUPPORTER_ACTIVE_WINDOW_DAYS, 5);
    });

    it("uses fallback tier 'Supporter' when tier_name is missing", () => {
      const update = computeSupporterUpdate(
        {
          amount: "3.00",
          currency: "USD",
          is_subscription_payment: true,
          tier_name: null,
        },
        NOW,
      );
      expect(update.supporterTier).toBe("Supporter");
    });

    it("increments only the total donated on a one-shot donation", () => {
      const update = computeSupporterUpdate(
        {
          amount: "5.00",
          currency: "USD",
          is_subscription_payment: false,
          tier_name: null,
        },
        NOW,
      );
      expect(update.supporterTier).toBeNull();
      expect(update.supporterActiveUntil).toBeNull();
      expect(update.currency).toBe("USD");
      expect(update.amountCentsDelta).toBe(500);
    });
  });

  describe("aggregateSupporterState", () => {
    const NOW = new Date("2026-04-22T12:00:00Z");

    it("returns empty currency map for an empty list", () => {
      const result = aggregateSupporterState([], NOW);
      expect(result.totalDonatedCentsByCurrency).toEqual({});
      expect(result.supporterTier).toBeNull();
      expect(result.supporterActiveUntil).toBeNull();
    });

    it("aggregates totals per currency without mixing them", () => {
      const result = aggregateSupporterState(
        [
          {
            isSubscriptionPayment: false,
            tierName: null,
            amountCents: 300,
            currency: "USD",
            receivedAt: NOW,
          },
          {
            isSubscriptionPayment: false,
            tierName: null,
            amountCents: 500,
            currency: "EUR",
            receivedAt: NOW,
          },
          {
            isSubscriptionPayment: false,
            tierName: null,
            amountCents: 200,
            currency: "USD",
            receivedAt: NOW,
          },
        ],
        NOW,
      );
      expect(result.totalDonatedCentsByCurrency).toEqual({
        USD: 500,
        EUR: 500,
      });
    });

    it("retains the latest active subscription tier across currencies", () => {
      const result = aggregateSupporterState(
        [
          {
            isSubscriptionPayment: true,
            tierName: "Gold Member",
            amountCents: 1000,
            currency: "USD",
            receivedAt: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000),
          },
          {
            isSubscriptionPayment: false,
            tierName: null,
            amountCents: 100,
            currency: "EUR",
            receivedAt: NOW,
          },
        ],
        NOW,
      );
      expect(result.supporterTier).toBe("Gold Member");
      expect(result.totalDonatedCentsByCurrency).toEqual({
        USD: 1000,
        EUR: 100,
      });
    });
  });

  describe("isSupporter", () => {
    const NOW = new Date("2026-04-22T12:00:00Z");

    it("is true when admin override patreon=true", () => {
      expect(
        isSupporter({ patreon: true, supporterActiveUntil: null }, NOW),
      ).toBe(true);
    });

    it("is true when supporterActiveUntil is in the future", () => {
      expect(
        isSupporter(
          {
            patreon: false,
            supporterActiveUntil: new Date("2026-05-01T00:00:00Z"),
          },
          NOW,
        ),
      ).toBe(true);
    });

    it("is false when supporterActiveUntil is in the past", () => {
      expect(
        isSupporter(
          {
            patreon: false,
            supporterActiveUntil: new Date("2026-03-01T00:00:00Z"),
          },
          NOW,
        ),
      ).toBe(false);
    });

    it("is false when both flags are absent", () => {
      expect(
        isSupporter({ patreon: false, supporterActiveUntil: null }, NOW),
      ).toBe(false);
    });
  });
});
