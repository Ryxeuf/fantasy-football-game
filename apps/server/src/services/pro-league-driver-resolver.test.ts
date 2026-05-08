/**
 * Sprint Pro League — Lot 3.B.1 : tests du resolver driverKind.
 *
 * Couvre la logique de cohabitation hybrid / full driver :
 *  - Default : la saison fournit la valeur par défaut (`driverKind`).
 *  - Override : `driverKindOverride` non-null sur le match prend
 *    précédence (utile pour A/B test progressif au sein d'une saison
 *    `hybrid` qui veut migrer un match en `full`, ou inversement
 *    pour rejouer un match `full` en `hybrid` après bug).
 *  - Garde-fous : valeurs invalides → fallback explicite sur `hybrid`.
 */

import { describe, expect, it } from "vitest";

import {
  isValidDriverKind,
  resolveDriverKind,
} from "./pro-league-driver-resolver";

describe("resolveDriverKind — Sprint Pro League Lot 3.B.1", () => {
  it("retourne le driver de la saison quand l'override est null", () => {
    expect(
      resolveDriverKind({
        seasonDriverKind: "hybrid",
        matchOverride: null,
      }),
    ).toBe("hybrid");

    expect(
      resolveDriverKind({
        seasonDriverKind: "full",
        matchOverride: null,
      }),
    ).toBe("full");
  });

  it("retourne le driver de la saison quand l'override est undefined", () => {
    expect(
      resolveDriverKind({
        seasonDriverKind: "hybrid",
        matchOverride: undefined,
      }),
    ).toBe("hybrid");
  });

  it("override = 'full' force le driver full malgré une saison hybrid", () => {
    expect(
      resolveDriverKind({
        seasonDriverKind: "hybrid",
        matchOverride: "full",
      }),
    ).toBe("full");
  });

  it("override = 'hybrid' force le driver hybrid malgré une saison full", () => {
    expect(
      resolveDriverKind({
        seasonDriverKind: "full",
        matchOverride: "hybrid",
      }),
    ).toBe("hybrid");
  });

  it("valeur invalide sur override → fallback sur saison", () => {
    expect(
      resolveDriverKind({
        seasonDriverKind: "full",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        matchOverride: "garbage" as any,
      }),
    ).toBe("full");
  });

  it("valeur invalide sur saison → fallback sur 'hybrid' (default safe)", () => {
    expect(
      resolveDriverKind({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seasonDriverKind: "" as any,
        matchOverride: null,
      }),
    ).toBe("hybrid");

    expect(
      resolveDriverKind({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seasonDriverKind: "garbage" as any,
        matchOverride: null,
      }),
    ).toBe("hybrid");
  });

  it("isValidDriverKind narrow correctement les valeurs", () => {
    expect(isValidDriverKind("hybrid")).toBe(true);
    expect(isValidDriverKind("full")).toBe(true);
    expect(isValidDriverKind("")).toBe(false);
    expect(isValidDriverKind("Hybrid")).toBe(false); // case-sensitive
    expect(isValidDriverKind(null)).toBe(false);
    expect(isValidDriverKind(undefined)).toBe(false);
    expect(isValidDriverKind(42)).toBe(false);
  });
});
