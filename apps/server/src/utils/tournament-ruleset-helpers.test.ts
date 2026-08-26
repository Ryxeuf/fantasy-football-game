/**
 * Barème de classement imposé par un règlement de tournoi. Sans cette
 * projection, une ligue ou une coupe créée sous le NAF World Cup 2027
 * classait ses équipes avec le barème maison (V 3 / N 1) au lieu du barème
 * du tournoi réellement joué (V 5 / N 2 / D 0 / concession -5).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Le parse passe par le repository : base d'abord, registre du moteur en
// repli. Table vide ici ⇒ c'est le registre qui répond.
vi.mock("../prisma", () => ({
  prisma: { tournamentRuleset: { findMany: vi.fn().mockResolvedValue([]) } },
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import { NAF_WORLD_CUP_2027 } from "@bb/game-engine";
import { invalidateTournamentRulesetCache } from "../services/tournament-ruleset-repository";
import {
  parseTournamentRuleset,
  tournamentResultPoints,
} from "./tournament-ruleset-helpers";

beforeEach(() => {
  invalidateTournamentRulesetCache();
});

describe("parseTournamentRuleset", () => {
  it("accepte l'absence de règlement", async () => {
    expect(await parseTournamentRuleset(undefined)).toEqual({
      ok: true,
      def: null,
    });
    expect(await parseTournamentRuleset(null)).toEqual({ ok: true, def: null });
    expect(await parseTournamentRuleset("")).toEqual({ ok: true, def: null });
  });

  it("résout un slug connu et refuse un slug inconnu", async () => {
    const parsed = await parseTournamentRuleset("naf_world_cup_2027");
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.def?.slug).toBe("naf_world_cup_2027");
    expect((await parseTournamentRuleset("ruleset_inconnu")).ok).toBe(false);
    expect((await parseTournamentRuleset(42)).ok).toBe(false);
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
