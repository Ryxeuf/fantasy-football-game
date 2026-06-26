/**
 * Régression : une édition admin d'un roster (dont la config staff) doit
 * pouvoir purger le cache mémoire des endpoints publics rosters, sinon
 * `/api/rosters[/:slug]` resert des données périmées (jusqu'à 5 min en prod)
 * et la page `/teams/:slug` + le builder ne reflètent pas le changement.
 */
import { describe, it, expect } from "vitest";
import { memoizeAsync, invalidateAllMemo } from "../utils/memoize-async";
import { invalidateRosterCaches } from "./public-rosters";

// Namespaces internes des endpoints rosters (alignés sur public-rosters.ts).
const ROSTER_DETAIL_NS = "public-rosters-detail";
const ROSTER_LIST_NS = "public-rosters-list";

describe("invalidateRosterCaches", () => {
  it("force le recalcul des valeurs mémoïsées des endpoints rosters", async () => {
    invalidateAllMemo();
    let calls = 0;
    const compute = () => Promise.resolve(++calls);

    // 1er appel : calcule et met en cache ; 2e : sert le cache.
    expect(await memoizeAsync(ROSTER_DETAIL_NS, "snotling", 60_000, compute)).toBe(1);
    expect(await memoizeAsync(ROSTER_DETAIL_NS, "snotling", 60_000, compute)).toBe(1);
    expect(await memoizeAsync(ROSTER_LIST_NS, "fr::season_3", 60_000, compute)).toBe(2);

    // Après invalidation, les deux namespaces recalculent.
    invalidateRosterCaches();
    expect(await memoizeAsync(ROSTER_DETAIL_NS, "snotling", 60_000, compute)).toBe(3);
    expect(await memoizeAsync(ROSTER_LIST_NS, "fr::season_3", 60_000, compute)).toBe(4);
  });
});
