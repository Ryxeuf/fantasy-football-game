/**
 * Barème de classement imposé par un règlement de tournoi. Sans cette
 * projection, une ligue ou une coupe créée sous le NAF World Cup 2027
 * classait ses équipes avec le barème maison (V 3 / N 1) au lieu du barème
 * du tournoi réellement joué (V 5 / N 2 / D 0 / concession -5).
 */

import { describe, it, expect } from "vitest";
import { NAF_WORLD_CUP_2027 } from "@bb/game-engine";
import {
  parseTournamentRuleset,
  tournamentResultPoints,
} from "./tournament-ruleset-helpers";

describe("parseTournamentRuleset", () => {
  it("accepte l'absence de règlement", () => {
    expect(parseTournamentRuleset(undefined)).toEqual({ ok: true, def: null });
    expect(parseTournamentRuleset(null)).toEqual({ ok: true, def: null });
    expect(parseTournamentRuleset("")).toEqual({ ok: true, def: null });
  });

  it("résout un slug connu et refuse un slug inconnu", () => {
    const parsed = parseTournamentRuleset("naf_world_cup_2027");
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.def?.slug).toBe("naf_world_cup_2027");
    expect(parseTournamentRuleset("ruleset_inconnu").ok).toBe(false);
  });
});

describe("tournamentResultPoints", () => {
  it("projette le barème du pack sur les colonnes de points", () => {
    expect(tournamentResultPoints(NAF_WORLD_CUP_2027)).toEqual({
      winPoints: 5,
      drawPoints: 2,
      lossPoints: 0,
      forfeitPoints: -5,
    });
  });

  it("la concession alimente forfeitPoints", () => {
    const def = {
      ...NAF_WORLD_CUP_2027,
      scoring: { win: 3, draw: 1, loss: 0, concession: -10 },
    };
    expect(tournamentResultPoints(def).forfeitPoints).toBe(-10);
  });
});
