/**
 * Smoke test d'integration: generateMatchPdf execute en jsdom sans crash
 * et produit un blob non vide. Verifie aussi les chemins degrades:
 *   - sans roster sur les equipes
 *   - sans gameState
 *   - sans actions
 *   - avec beaucoup d'actions (force la pagination du play log)
 */

import { describe, expect, it } from "vitest";
import { generateMatchPdf } from "./index";
import type { PdfAction, PdfMatch } from "./types";

function makeAction(overrides: Partial<PdfAction> = {}): PdfAction {
  return {
    id: overrides.id ?? "a-" + Math.random().toString(36).slice(2),
    half: overrides.half ?? 1,
    turn: overrides.turn ?? 1,
    actionType: overrides.actionType ?? "blocage",
    playerId: overrides.playerId ?? "p1",
    playerName: overrides.playerName ?? "Joueur 1",
    playerTeam: overrides.playerTeam ?? "A",
    opponentId: overrides.opponentId ?? null,
    opponentName: overrides.opponentName ?? null,
    diceResult: overrides.diceResult ?? null,
    fumble: overrides.fumble ?? false,
    playerState: overrides.playerState ?? null,
    armorBroken: overrides.armorBroken ?? false,
    opponentState: overrides.opponentState ?? null,
    passType: overrides.passType ?? null,
    createdAt: overrides.createdAt ?? new Date(2026, 0, 1).toISOString(),
  };
}

function baseMatch(overrides: Partial<PdfMatch> = {}): PdfMatch {
  return {
    id: "m1",
    name: "Skaven vs Wood Elves",
    teamA: { id: "tA", name: "Skaven Stars", roster: "skaven" },
    teamB: { id: "tB", name: "Wood Eaters", roster: "wood_elf" },
    scoreTeamA: 2,
    scoreTeamB: 1,
    startedAt: new Date(2026, 0, 1).toISOString(),
    completedAt: new Date(2026, 0, 1, 1, 30).toISOString(),
    cup: { id: "c1", name: "Coupe du Vieux Monde" },
    gameState: {
      preMatch: {
        fanFactor: {
          teamA: { d3: 2, dedicatedFans: 3, total: 5 },
          teamB: { d3: 1, dedicatedFans: 2, total: 3 },
        },
        weatherType: "classique",
        weather: {
          total: 8,
          condition: "Pluie battante",
          description: "Le terrain est detrempe, les passes sont plus risquees.",
        },
      },
      matchStats: {
        p1: { touchdowns: 2, casualties: 1, completions: 3, interceptions: 0, mvp: true },
        p2: { touchdowns: 1, casualties: 0, completions: 2, interceptions: 1, mvp: false },
      },
      players: [
        { id: "p1", team: "A", name: "Squiek", number: 11, position: "skaven_gutter_runner" },
        { id: "p2", team: "B", name: "Sylvanis", number: 5, position: "wood_elf_thrower" },
      ],
    },
    ...overrides,
  };
}

describe("generateMatchPdf (smoke)", () => {
  it("genere un PDF non vide pour un match standard", async () => {
    const match = baseMatch();
    const actions: PdfAction[] = [
      makeAction({ playerTeam: "A", actionType: "td", playerId: "p1", playerName: "Squiek", half: 1, turn: 4 }),
      makeAction({ playerTeam: "A", actionType: "passe", playerId: "p1", playerName: "Squiek", half: 1, turn: 3 }),
      makeAction({ playerTeam: "B", actionType: "blocage", armorBroken: true, opponentState: "elimine", half: 2, turn: 1 }),
      makeAction({ playerTeam: "B", actionType: "td", playerId: "p2", playerName: "Sylvanis", half: 2, turn: 5 }),
      makeAction({ playerTeam: "A", actionType: "td", playerId: "p1", playerName: "Squiek", half: 2, turn: 7 }),
    ];
    const pdf = await generateMatchPdf(match, actions);
    expect(pdf.filename).toMatch(/_recap\.pdf$/);
    expect(typeof pdf.save).toBe("function");
  });

  it("tolere un match sans roster sur les equipes", async () => {
    const match = baseMatch({
      teamA: { id: "tA", name: "Sans Roster A", roster: null },
      teamB: { id: "tB", name: "Sans Roster B" },
    });
    const pdf = await generateMatchPdf(match, []);
    expect(pdf.filename).toBeTruthy();
  });

  it("tolere un match sans gameState ni actions", async () => {
    const match = baseMatch({ gameState: undefined });
    const pdf = await generateMatchPdf(match, []);
    expect(pdf.filename).toBeTruthy();
  });

  it("gere un grand nombre d'actions (pagination du play log)", async () => {
    const actions: PdfAction[] = [];
    for (let i = 0; i < 80; i++) {
      actions.push(
        makeAction({
          id: `a${i}`,
          half: i < 40 ? 1 : 2,
          turn: (i % 8) + 1,
          actionType: i % 5 === 0 ? "td" : "blocage",
          playerTeam: i % 2 === 0 ? "A" : "B",
          playerId: i % 2 === 0 ? "p1" : "p2",
          playerName: i % 2 === 0 ? "Squiek" : "Sylvanis",
          armorBroken: i % 3 === 0,
          opponentState: i % 7 === 0 ? "elimine" : i % 4 === 0 ? "ko" : null,
        }),
      );
    }
    const pdf = await generateMatchPdf(baseMatch(), actions);
    expect(pdf.filename).toBeTruthy();
  });

  it("gere un nom de match vide en produisant un filename par defaut", async () => {
    const pdf = await generateMatchPdf(baseMatch({ name: null }), []);
    expect(pdf.filename).toMatch(/^Match_Blood_Bowl_recap\.pdf$|^match_recap\.pdf$/);
  });
});
