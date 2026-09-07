import { describe, it, expect } from "vitest";
import {
  formatRelativeTime,
  notificationIcon,
  safeInternalUrl,
  NOTIFICATIONS_PAGE_SIZE,
} from "./format";

const labels = {
  justNow: "à l'instant",
  minutesAgo: "il y a {count} min",
  hoursAgo: "il y a {count} h",
  daysAgo: "il y a {count} j",
};
const now = new Date("2026-09-07T12:00:00.000Z");

describe("formatRelativeTime", () => {
  it("paliers minute / heure / jour", () => {
    expect(formatRelativeTime("2026-09-07T11:59:40.000Z", labels, now)).toBe("à l'instant");
    expect(formatRelativeTime("2026-09-07T11:35:00.000Z", labels, now)).toBe("il y a 25 min");
    expect(formatRelativeTime("2026-09-07T09:10:00.000Z", labels, now)).toBe("il y a 2 h");
    expect(formatRelativeTime("2026-09-04T12:00:00.000Z", labels, now)).toBe("il y a 3 j");
  });
  it("date locale au-delà de 7 jours, vide si invalide, futur = à l'instant", () => {
    expect(formatRelativeTime("2026-08-01T12:00:00.000Z", labels, now, "fr-FR")).toMatch(/2026/);
    expect(formatRelativeTime("not-a-date", labels, now)).toBe("");
    expect(formatRelativeTime("2026-09-08T12:00:00.000Z", labels, now)).toBe("à l'instant");
  });
});

describe("notificationIcon", () => {
  it("choisit le pictogramme par famille", () => {
    expect(notificationIcon("league.invitation")).toBe("🏅");
    expect(notificationIcon("league.round_pairing")).toBe("📅");
    expect(notificationIcon("league.match_validation")).toBe("📝");
    expect(notificationIcon("cup.invitation")).toBe("🏆");
    expect(notificationIcon("friend.request")).toBe("🤝");
    expect(notificationIcon("league.archived")).toBe("📦");
    expect(notificationIcon("cup.deleted")).toBe("🗑️");
    expect(notificationIcon("something.else")).toBe("🔔");
  });
});

describe("safeInternalUrl", () => {
  it("n'accepte que les chemins relatifs au site", () => {
    expect(safeInternalUrl("/leagues/abc")).toBe("/leagues/abc");
    expect(safeInternalUrl(null)).toBeNull();
    expect(safeInternalUrl("")).toBeNull();
    expect(safeInternalUrl("https://evil.test/x")).toBeNull();
    expect(safeInternalUrl("//evil.test/x")).toBeNull();
    expect(safeInternalUrl("javascript:alert(1)")).toBeNull();
  });
  it("expose la taille de page", () => {
    expect(NOTIFICATIONS_PAGE_SIZE).toBe(50);
  });
});
