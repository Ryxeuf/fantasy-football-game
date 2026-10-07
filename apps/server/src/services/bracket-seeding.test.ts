/**
 * Moteur de bracket partagé ligue ↔ coupe — résumé des quotas de poule.
 * (Le seeding lui-même est couvert par `league-playoffs.test.ts`, qui
 * ré-exporte ce module.)
 */

import { describe, it, expect } from "vitest";
import {
  selectSeedsFromPools,
  summarizePoolQualification,
} from "./bracket-seeding";

const pool = (
  id: string,
  order: number,
  qualifiesForPlayoffs: number,
  name = `Poule ${id}`,
) => ({ id, name, order, qualifiesForPlayoffs });

describe("summarizePoolQualification", () => {
  it("annonce un TOTAL, détaillé poule par poule (2 poules à 4 = 8)", () => {
    const out = summarizePoolQualification(
      [pool("a", 0, 4, "Poule A"), pool("b", 1, 4, "Poule B")],
      8,
    );
    expect(out).toEqual({
      totalQualified: 8,
      playoffSize: 8,
      consistent: true,
      pools: [
        { poolId: "a", name: "Poule A", qualifiesForPlayoffs: 4 },
        { poolId: "b", name: "Poule B", qualifiesForPlayoffs: 4 },
      ],
    });
  });

  it("signale une somme qui ne vaut pas la taille du bracket", () => {
    const out = summarizePoolQualification(
      [pool("a", 0, 4), pool("b", 1, 4), pool("c", 2, 4), pool("d", 3, 4)],
      8,
    );
    expect(out.totalQualified).toBe(16);
    expect(out.consistent).toBe(false);
  });

  it("garde les poules à 0 dans le détail (c'est elles qui manquent)", () => {
    const out = summarizePoolQualification(
      [pool("a", 0, 4), pool("b", 1, 0)],
      8,
    );
    expect(out.pools.map((p) => p.qualifiesForPlayoffs)).toEqual([4, 0]);
    expect(out.consistent).toBe(false);
  });

  it("trie par ordre de poule puis par id, comme le serpentin du seeding", () => {
    const out = summarizePoolQualification(
      [pool("z", 1, 2), pool("b", 0, 2), pool("a", 0, 2)],
      6,
    );
    expect(out.pools.map((p) => p.poolId)).toEqual(["a", "b", "z"]);
  });

  it("borne un quota négatif à 0, comme le seeding", () => {
    const pools = [pool("a", 0, 4), pool("b", 1, -2)];
    const out = summarizePoolQualification(pools, 4);
    expect(out.totalQualified).toBe(4);
    expect(out.pools[1].qualifiesForPlayoffs).toBe(0);
    // Le panneau et le seeding ne peuvent pas diverger.
    const seeding = selectSeedsFromPools(
      pools.map((p) => ({
        poolId: p.id,
        poolOrder: p.order,
        qualifiesForPlayoffs: p.qualifiesForPlayoffs,
        ranked: ["t1", "t2", "t3", "t4"],
      })),
      4,
    );
    expect(out.consistent).toBe(true);
    expect(seeding.ok).toBe(true);
  });

  it("sans poule : total nul, cohérent, détail vide", () => {
    expect(summarizePoolQualification([], 4)).toEqual({
      totalQualified: 0,
      playoffSize: 4,
      consistent: true,
      pools: [],
    });
  });
});
