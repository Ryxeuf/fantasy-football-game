/**
 * Détail des quotas de poule annoncé par le panneau de lancement des
 * play-offs (ligue et coupe).
 */
import { describe, it, expect } from "vitest";
import { formatPoolBreakdown } from "./pool-qualification";

const pool = (name: string, qualifiesForPlayoffs: number) => ({
  poolId: name,
  name,
  qualifiesForPlayoffs,
});

describe("formatPoolBreakdown", () => {
  it("détaille chaque poule dans l'ordre servi", () => {
    expect(formatPoolBreakdown([pool("Poule A", 4), pool("Poule B", 4)])).toBe(
      "Poule A : 4 · Poule B : 4",
    );
  });

  it("garde les poules à 0", () => {
    expect(formatPoolBreakdown([pool("Poule A", 4), pool("Poule B", 0)])).toBe(
      "Poule A : 4 · Poule B : 0",
    );
  });

  it("accepte la ponctuation d'une autre langue", () => {
    expect(
      formatPoolBreakdown(
        [pool("Group A", 2), pool("Group B", 2)],
        (name, n) => `${name}: ${n}`,
      ),
    ).toBe("Group A: 2 · Group B: 2");
  });

  it("rend null sans détail (API antérieure ou sans poule)", () => {
    expect(formatPoolBreakdown(undefined)).toBeNull();
    expect(formatPoolBreakdown([])).toBeNull();
  });
});
