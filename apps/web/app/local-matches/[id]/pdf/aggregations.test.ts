/**
 * Tests unitaires des agregations utilisees par le PDF de recap.
 * Logique pure: aucune dependance jsPDF, runnable en jsdom.
 */

import { describe, expect, it } from "vitest";
import {
  computeAggregates,
  computeMvp,
  computeOutcome,
  computeTeamStats,
  countActionsByType,
} from "./aggregations";
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
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

const baseMatch: PdfMatch = {
  id: "m1",
  name: "Test Match",
  teamA: { id: "tA", name: "Skaven Stars", roster: "skaven" },
  teamB: { id: "tB", name: "Wood Eaters", roster: "wood_elf" },
  scoreTeamA: 2,
  scoreTeamB: 1,
  startedAt: null,
  completedAt: null,
  cup: null,
  gameState: undefined,
};

describe("computeOutcome", () => {
  it("retourne A quand scoreA > scoreB", () => {
    expect(computeOutcome(2, 1)).toBe("A");
  });
  it("retourne B quand scoreB > scoreA", () => {
    expect(computeOutcome(0, 3)).toBe("B");
  });
  it("retourne DRAW quand egalite", () => {
    expect(computeOutcome(1, 1)).toBe("DRAW");
    expect(computeOutcome(null, null)).toBe("DRAW");
  });
});

describe("computeTeamStats", () => {
  it("compte correctement les TD, passes, blocs, fumbles par equipe", () => {
    const actions: PdfAction[] = [
      makeAction({ playerTeam: "A", actionType: "td" }),
      makeAction({ playerTeam: "A", actionType: "passe" }),
      makeAction({ playerTeam: "A", actionType: "passe", fumble: true }),
      makeAction({ playerTeam: "B", actionType: "blocage", armorBroken: true, opponentState: "elimine" }),
      makeAction({ playerTeam: "B", actionType: "blitz", armorBroken: true, opponentState: "ko" }),
      makeAction({ playerTeam: "B", actionType: "aggression", armorBroken: false }),
    ];
    const { teamA, teamB } = computeTeamStats(actions);

    expect(teamA.touchdowns).toBe(1);
    expect(teamA.completions).toBe(1);
    expect(teamA.fumbles).toBe(1);
    expect(teamA.totalActions).toBe(3);

    expect(teamB.blocks).toBe(1);
    expect(teamB.blitzes).toBe(1);
    expect(teamB.fouls).toBe(1);
    expect(teamB.armorBreaks).toBe(2);

    // Convention BB — casualty/KO credites a l'equipe AGISSANTE (B), pas a la victime.
    expect(teamB.casualties).toBe(1);
    expect(teamB.kos).toBe(1);
    expect(teamA.casualties).toBe(0);
    expect(teamA.kos).toBe(0);
  });

  it("retourne stats vides pour 0 action", () => {
    const { teamA, teamB } = computeTeamStats([]);
    expect(teamA.totalActions).toBe(0);
    expect(teamB.totalActions).toBe(0);
  });
});

describe("countActionsByType", () => {
  it("groupe par equipe et type", () => {
    const actions: PdfAction[] = [
      makeAction({ playerTeam: "A", actionType: "passe" }),
      makeAction({ playerTeam: "A", actionType: "passe" }),
      makeAction({ playerTeam: "B", actionType: "blocage" }),
    ];
    const counts = countActionsByType(actions);
    expect(counts.A.passe).toBe(2);
    expect(counts.B.blocage).toBe(1);
    expect(counts.A.blocage).toBeUndefined();
  });
});

describe("computeMvp", () => {
  it("priorise un joueur marque MVP dans matchStats meme avec moins de SPP", () => {
    const match: PdfMatch = {
      ...baseMatch,
      gameState: {
        matchStats: {
          p1: { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0, mvp: true },
          p2: { touchdowns: 3, casualties: 2, completions: 5, interceptions: 1, mvp: false },
        },
        players: [
          { id: "p1", team: "A", name: "MVP Officiel", number: 1, position: "skaven_blitzer" },
          { id: "p2", team: "B", name: "Top Scorer", number: 7, position: "wood_elf_thrower" },
        ],
      },
    };
    const mvp = computeMvp(match, []);
    expect(mvp).not.toBeNull();
    expect(mvp?.playerId).toBe("p1");
    expect(mvp?.playerName).toBe("MVP Officiel");
  });

  it("a defaut, choisit le joueur avec le plus haut SPP", () => {
    const match: PdfMatch = {
      ...baseMatch,
      gameState: {
        matchStats: {
          p1: { touchdowns: 1, casualties: 0, completions: 0, interceptions: 0, mvp: false },
          p2: { touchdowns: 0, casualties: 2, completions: 0, interceptions: 0, mvp: false },
        },
        players: [
          { id: "p1", team: "A", name: "Scorer", number: 1, position: "skaven_blitzer" },
          { id: "p2", team: "B", name: "Killer", number: 2, position: "wood_elf_treeman" },
        ],
      },
    };
    const mvp = computeMvp(match, []);
    expect(mvp?.playerId).toBe("p2"); // 2 cas * 2 = 4 SPP > 1 TD * 3 = 3 SPP
  });

  it("retourne null si aucune donnee disponible", () => {
    expect(computeMvp(baseMatch, [])).toBeNull();
  });

  it("fallback: derive le MVP depuis les actions si gameState absent", () => {
    const actions: PdfAction[] = [
      makeAction({ playerId: "p1", playerName: "Speedy", playerTeam: "A", actionType: "td" }),
      makeAction({ playerId: "p1", playerName: "Speedy", playerTeam: "A", actionType: "td" }),
      makeAction({ playerId: "p2", playerName: "Smasher", playerTeam: "B", actionType: "blocage", armorBroken: true, opponentState: "elimine" }),
    ];
    const mvp = computeMvp(baseMatch, actions);
    expect(mvp?.playerId).toBe("p1");
    expect(mvp?.touchdowns).toBe(2);
    expect(mvp?.spp).toBe(6); // 2 * 3
  });
});

describe("computeAggregates", () => {
  it("expose teamA, teamB, mvp et outcome", () => {
    const actions: PdfAction[] = [
      makeAction({ playerTeam: "A", actionType: "td", playerId: "p1", playerName: "Star" }),
      makeAction({ playerTeam: "A", actionType: "td", playerId: "p1", playerName: "Star" }),
    ];
    const agg = computeAggregates({ ...baseMatch, scoreTeamA: 2, scoreTeamB: 0 }, actions);
    expect(agg.teamA.touchdowns).toBe(2);
    expect(agg.teamB.touchdowns).toBe(0);
    expect(agg.outcome).toBe("A");
    expect(agg.mvp?.playerId).toBe("p1");
  });
});
