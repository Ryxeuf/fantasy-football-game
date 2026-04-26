/**
 * Tests pour le helper Umami events (Q.19 — Sprint 23).
 *
 * Le helper expose `trackUmamiEvent(name, data?)` qui appelle
 * `window.umami.track(name, data)` si Umami est charge, sinon ne fait
 * rien (silencieux en dev / quand l opt-out est actif). Cela evite
 * d'avoir a tester `typeof window === 'undefined'` partout.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  trackUmamiEvent,
  UMAMI_EVENTS,
  type UmamiEventName,
} from "./umami-events";

describe("UMAMI_EVENTS", () => {
  it("expose les 4 events de Q.19", () => {
    expect(UMAMI_EVENTS.TEAM_CLICK).toBeTruthy();
    expect(UMAMI_EVENTS.STAR_PLAYER_HIRE).toBeTruthy();
    expect(UMAMI_EVENTS.PDF_EXPORT).toBeTruthy();
    expect(UMAMI_EVENTS.SUPPORT_CTA).toBeTruthy();
  });

  it("toutes les valeurs sont distinctes", () => {
    const values = Object.values(UMAMI_EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });

  it("toutes les valeurs sont en kebab-case lisible", () => {
    for (const v of Object.values(UMAMI_EVENTS)) {
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
      expect(/^[a-z][a-z0-9-]*$/.test(v as string)).toBe(true);
    }
  });
});

describe("trackUmamiEvent", () => {
  let originalUmami: unknown;

  beforeEach(() => {
    originalUmami = (globalThis as Record<string, unknown>).umami;
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).umami = originalUmami as never;
  });

  it("ne crashe pas si window.umami est absent", () => {
    delete (globalThis as Record<string, unknown>).umami;
    expect(() =>
      trackUmamiEvent(UMAMI_EVENTS.TEAM_CLICK as UmamiEventName, {
        slug: "skaven",
      }),
    ).not.toThrow();
  });

  it("appelle window.umami.track avec event + data quand disponible", () => {
    const track = vi.fn();
    (globalThis as Record<string, unknown>).umami = { track };
    trackUmamiEvent(UMAMI_EVENTS.TEAM_CLICK as UmamiEventName, {
      slug: "skaven",
    });
    expect(track).toHaveBeenCalledWith("team-click", { slug: "skaven" });
  });

  it("appelle track sans data quand non fournie", () => {
    const track = vi.fn();
    (globalThis as Record<string, unknown>).umami = { track };
    trackUmamiEvent(UMAMI_EVENTS.SUPPORT_CTA as UmamiEventName);
    expect(track).toHaveBeenCalledWith("support-cta", undefined);
  });

  it("ne crashe pas si window.umami.track est absent", () => {
    (globalThis as Record<string, unknown>).umami = {};
    expect(() =>
      trackUmamiEvent(UMAMI_EVENTS.PDF_EXPORT as UmamiEventName),
    ).not.toThrow();
  });

  it("avale les exceptions du tracker (non bloquant)", () => {
    const track = vi.fn(() => {
      throw new Error("network down");
    });
    (globalThis as Record<string, unknown>).umami = { track };
    expect(() =>
      trackUmamiEvent(UMAMI_EVENTS.PDF_EXPORT as UmamiEventName),
    ).not.toThrow();
  });

  it("rejette silencieusement les noms d event vides", () => {
    const track = vi.fn();
    (globalThis as Record<string, unknown>).umami = { track };
    trackUmamiEvent("" as UmamiEventName);
    expect(track).not.toHaveBeenCalled();
  });
});
