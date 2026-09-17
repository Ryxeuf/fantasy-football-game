/**
 * Les helpers de départage historiquement définis dans `services/league.ts`
 * vivent désormais dans `services/league-standings-order` (PUR). Ce fichier
 * ne teste plus la règle — c'est le rôle de
 * `league-standings-order.test.ts` — mais garde le CONTRAT : les noms
 * exportés par `league.ts` restent branchés sur ce module, pour qu'une
 * seconde implémentation ne puisse pas réapparaître à côté.
 */

import { describe, it, expect } from "vitest";
import {
  TIE_BREAK_SLUGS,
  parseTieBreakRules,
  makeStandingsComparator,
  isSeasonEloRanked,
} from "./league";
import {
  LEAGUE_TIE_BREAK_SLUGS,
  parseLeagueTieBreakRules,
  makeLeagueStandingsComparator,
  isSeasonEloRanked as isSeasonEloRankedPure,
} from "./league-standings-order";

describe("alias de départage exposés par services/league", () => {
  it("réexportent le module pur, sans seconde implémentation", () => {
    expect(TIE_BREAK_SLUGS).toBe(LEAGUE_TIE_BREAK_SLUGS);
    expect(parseTieBreakRules).toBe(parseLeagueTieBreakRules);
    expect(makeStandingsComparator).toBe(makeLeagueStandingsComparator);
    expect(isSeasonEloRanked).toBe(isSeasonEloRankedPure);
  });

  it("servent l'ordre par défaut demandé (points, bonus, forfaits, TD, sorties)", () => {
    expect(parseTieBreakRules(null)).toEqual([
      "points",
      "bonus_points",
      "forfeit_points",
      "td_diff",
      "cas_diff",
      "name",
    ]);
  });
});
