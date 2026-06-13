import { describe, it, expect } from "vitest";
import {
  buildDigestEmail,
  selectStaleRecipients,
  DIGEST_IDEMPOTENCE_WINDOW_MS,
  type DigestData,
  type DigestRecipientRow,
} from "./weekly-digest";

const baseData: DigestData = {
  coachName: "Grimgor",
  email: "grimgor@waaagh.test",
  teams: [{ name: "Da Boyz" }, { name: "Skull Krushers" }],
  pendingMatchCount: 0,
  gazetteHeadline: null,
  unsubscribeUrl: "https://api.test/email/unsubscribe?token=abc.def",
  appUrl: "https://nufflearena.test",
};

describe("buildDigestEmail", () => {
  it("includes coach name, teams, CTA and unsubscribe link", () => {
    const { subject, text, html } = buildDigestEmail(baseData);
    expect(subject).toContain("Nuffle Arena");
    expect(text).toContain("Grimgor");
    expect(text).toContain("Da Boyz");
    expect(text).toContain("Skull Krushers");
    expect(text).toContain(baseData.appUrl);
    expect(text).toContain(baseData.unsubscribeUrl);
    expect(html).toContain("Grimgor");
    expect(html).toContain(baseData.unsubscribeUrl);
    expect(html).toContain(baseData.appUrl);
  });

  it("leads the subject with pending matches when present (réengagement)", () => {
    const { subject, text } = buildDigestEmail({
      ...baseData,
      pendingMatchCount: 3,
    });
    expect(subject).toContain("3 matchs");
    expect(text).toContain("3 match");
  });

  it("singularizes a single pending match", () => {
    const { subject } = buildDigestEmail({
      ...baseData,
      pendingMatchCount: 1,
    });
    expect(subject).toContain("1 match vous attend");
    expect(subject).not.toContain("matchs");
  });

  it("surfaces the latest Gazette headline when present", () => {
    const { text, html } = buildDigestEmail({
      ...baseData,
      gazetteHeadline: "Les Reikland Reavers humilient les Orcs",
    });
    expect(text).toContain("Les Reikland Reavers humilient les Orcs");
    expect(html).toContain("Les Reikland Reavers humilient les Orcs");
  });

  it("falls back to an onboarding message when the coach has nothing", () => {
    const { text } = buildDigestEmail({
      ...baseData,
      teams: [],
      pendingMatchCount: 0,
      gazetteHeadline: null,
    });
    expect(text).toContain("créez une équipe");
  });

  it("escapes HTML in user-controlled fields (no injection)", () => {
    const { html } = buildDigestEmail({
      ...baseData,
      coachName: '<script>alert(1)</script>',
      teams: [{ name: "<img src=x onerror=alert(2)>" }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<img src=x");
  });
});

describe("selectStaleRecipients", () => {
  const now = new Date("2026-06-13T12:00:00Z");

  function row(
    userId: string,
    enabled: boolean,
    lastSentAt: Date | null,
  ): DigestRecipientRow {
    return { userId, enabled, lastSentAt };
  }

  it("excludes opted-out recipients", () => {
    const rows = [row("a", false, null), row("b", true, null)];
    const out = selectStaleRecipients(rows, now);
    expect(out.map((r) => r.userId)).toEqual(["b"]);
  });

  it("includes opt-in recipients never sent to", () => {
    const out = selectStaleRecipients([row("a", true, null)], now);
    expect(out).toHaveLength(1);
  });

  it("excludes recipients sent within the idempotence window", () => {
    const recent = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
    const out = selectStaleRecipients([row("a", true, recent)], now);
    expect(out).toHaveLength(0);
  });

  it("includes recipients sent before the window (next week)", () => {
    const old = new Date(now.getTime() - DIGEST_IDEMPOTENCE_WINDOW_MS - 1000);
    const out = selectStaleRecipients([row("a", true, old)], now);
    expect(out).toHaveLength(1);
  });

  it("respects a custom window of 0 (force re-send)", () => {
    const recent = new Date(now.getTime() - 1000);
    const out = selectStaleRecipients([row("a", true, recent)], now, 0);
    expect(out).toHaveLength(1);
  });
});
