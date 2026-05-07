/**
 * S27.8.10 — Smoke tests pour les handlers block-related extraits dans
 * `actions/block-action.ts`.
 *
 * Le comportement metier complet de `handleBlock`, du Multiple Block et du
 * Frenzy second bloc est deja couvert par les tests d'integration
 * (`applyMove` + `mechanics/multiple-block.test.ts` + `mechanics/blocking.test.ts`).
 *
 * Ces smoke tests verifient uniquement que :
 *  1. les exports nouvellement publics existent et sont des fonctions,
 *  2. les gates triviales rendent l'etat inchange (no-op safe quand le
 *     pending flag n'est pas present, quand l'attaquant n'existe pas,
 *     etc.),
 *  3. l'extraction n'introduit pas de cycle d'import (le simple fait
 *     d'importer ce module sans erreur sert de garde-fou).
 */

import { describe, it, expect } from "vitest";
import type { GameState, Player, RNG } from "../core/types";
import {
  handleBlock,
  handleMultiBlock,
  resolveFrenzyBlock,
  resolveMultipleBlock,
} from "./block-action";

const rng: RNG = () => 0.5;

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p",
    team: "A",
    pos: { x: 0, y: 0 },
    name: "P",
    number: 1,
    position: "Lineman",
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    ...overrides,
  };
}

function makeState(players: Player[]): GameState {
  return {
    width: 26,
    height: 15,
    players,
    currentPlayer: "A",
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: true, teamB: true },
    dugouts: {
      teamA: { reserves: [], ko: [], casualties: [] },
      teamB: { reserves: [], ko: [], casualties: [] },
    },
    gamePhase: "playing",
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: "A", teamB: "B" },
    teamRosters: { teamA: "skaven", teamB: "human" },
    pm: 0,
    gameLog: [],
    playerActions: {},
    teamBlitzCount: { A: 0, B: 0 },
    teamFoulCount: { A: 0, B: 0 },
    matchStats: {},
  } as unknown as GameState;
}

describe("S27.8.10 — block-action exports", () => {
  it("expose les 4 handlers block-related", () => {
    expect(typeof handleBlock).toBe("function");
    expect(typeof handleMultiBlock).toBe("function");
    expect(typeof resolveFrenzyBlock).toBe("function");
    expect(typeof resolveMultipleBlock).toBe("function");
  });
});

describe("resolveFrenzyBlock — gates", () => {
  it("retourne l'etat inchange si pas de pendingFrenzyBlock", () => {
    const state = makeState([makePlayer({ id: "A1" })]);
    const result = resolveFrenzyBlock(state, rng);
    expect(result).toBe(state);
  });

  it("attend la fin du push choice avant de resoudre", () => {
    const state: GameState = {
      ...makeState([makePlayer({ id: "A1" }), makePlayer({ id: "B1", team: "B", pos: { x: 1, y: 0 } })]),
      pendingFrenzyBlock: { attackerId: "A1", targetId: "B1" },
      pendingPushChoice: {
        attackerId: "A1",
        targetId: "B1",
        from: { x: 0, y: 0 },
        squares: [{ x: 1, y: 0 }],
      },
    } as unknown as GameState;
    const result = resolveFrenzyBlock(state, rng);
    // Pending choice toujours present : on ne resout pas.
    expect(result).toBe(state);
  });

  it("attend la fin du follow-up choice avant de resoudre", () => {
    const state: GameState = {
      ...makeState([makePlayer({ id: "A1" }), makePlayer({ id: "B1", team: "B", pos: { x: 1, y: 0 } })]),
      pendingFrenzyBlock: { attackerId: "A1", targetId: "B1" },
      pendingFollowUpChoice: {
        attackerId: "A1",
        targetId: "B1",
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
      },
    } as unknown as GameState;
    const result = resolveFrenzyBlock(state, rng);
    expect(result).toBe(state);
  });

  it("nettoie le pending si attaquant ou cible introuvable", () => {
    const state: GameState = {
      ...makeState([makePlayer({ id: "A1" })]),
      pendingFrenzyBlock: { attackerId: "A1", targetId: "GHOST" },
    } as unknown as GameState;
    const result = resolveFrenzyBlock(state, rng);
    expect(result.pendingFrenzyBlock).toBeUndefined();
  });

  it("nettoie le pending si non-adjacent (annule le 2e bloc)", () => {
    const attacker = makePlayer({ id: "A1", pos: { x: 0, y: 0 } });
    const target = makePlayer({ id: "B1", team: "B", pos: { x: 5, y: 5 } });
    const state: GameState = {
      ...makeState([attacker, target]),
      pendingFrenzyBlock: { attackerId: "A1", targetId: "B1" },
    } as unknown as GameState;
    const result = resolveFrenzyBlock(state, rng);
    expect(result.pendingFrenzyBlock).toBeUndefined();
  });
});

describe("resolveMultipleBlock — gates", () => {
  it("retourne l'etat inchange si pas de pendingMultipleBlock", () => {
    const state = makeState([makePlayer({ id: "A1" })]);
    const result = resolveMultipleBlock(state, rng);
    expect(result).toBe(state);
  });

  it("attend la fin du pendingBlock avant de resoudre", () => {
    const state: GameState = {
      ...makeState([makePlayer({ id: "A1" })]),
      pendingMultipleBlock: { attackerId: "A1", secondTargetId: "B2" },
      pendingBlock: {
        attackerId: "A1",
        targetId: "B1",
        options: ["push"],
        chooser: "attacker",
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 3,
        targetStrength: 3,
      },
    } as unknown as GameState;
    const result = resolveMultipleBlock(state, rng);
    expect(result).toBe(state);
  });

  it("nettoie le flag si secondTargetId absent (sequence terminee)", () => {
    const state: GameState = {
      ...makeState([makePlayer({ id: "A1" })]),
      pendingMultipleBlock: { attackerId: "A1", secondTargetId: undefined },
    } as unknown as GameState;
    const result = resolveMultipleBlock(state, rng);
    expect(result.pendingMultipleBlock).toBeUndefined();
  });

  it("nettoie le flag sur turnover (pas de second bloc)", () => {
    const attacker = makePlayer({ id: "A1", pos: { x: 0, y: 0 } });
    const target = makePlayer({ id: "B2", team: "B", pos: { x: 1, y: 0 } });
    const state: GameState = {
      ...makeState([attacker, target]),
      isTurnover: true,
      pendingMultipleBlock: { attackerId: "A1", secondTargetId: "B2" },
    } as unknown as GameState;
    const result = resolveMultipleBlock(state, rng);
    expect(result.pendingMultipleBlock).toBeUndefined();
  });

  it("logge l'annulation et nettoie si non-adjacent", () => {
    const attacker = makePlayer({ id: "A1", pos: { x: 0, y: 0 } });
    const target = makePlayer({ id: "B2", team: "B", pos: { x: 8, y: 8 } });
    const state: GameState = {
      ...makeState([attacker, target]),
      pendingMultipleBlock: { attackerId: "A1", secondTargetId: "B2" },
    } as unknown as GameState;
    const result = resolveMultipleBlock(state, rng);
    expect(result.pendingMultipleBlock).toBeUndefined();
    expect(result.gameLog.some((e) => /Multiple|hors de portee/.test(e.message))).toBe(true);
  });
});

describe("handleMultiBlock — gates", () => {
  it("retourne l'etat inchange si l'attaquant n'existe pas", () => {
    const state = makeState([makePlayer({ id: "A1" })]);
    const result = handleMultiBlock(
      state,
      {
        type: "MULTI_BLOCK",
        playerId: "GHOST",
        firstTargetId: "B1",
        secondTargetId: "B2",
      },
      rng,
    );
    // Sans canPerformMultipleBlock OK, on retourne l'etat tel quel.
    expect(result).toBe(state);
  });

  it("retourne l'etat inchange (no-op) si Multiple Block non legal sans skill", () => {
    // Attaquant sans skill 'multiple-block' : la mecanique gate refuse.
    const attacker = makePlayer({
      id: "A1",
      team: "A",
      skills: [],
      pos: { x: 0, y: 0 },
    });
    const target1 = makePlayer({ id: "B1", team: "B", pos: { x: 1, y: 0 } });
    const target2 = makePlayer({ id: "B2", team: "B", pos: { x: 0, y: 1 } });
    const state = makeState([attacker, target1, target2]);
    const result = handleMultiBlock(
      state,
      {
        type: "MULTI_BLOCK",
        playerId: "A1",
        firstTargetId: "B1",
        secondTargetId: "B2",
      },
      rng,
    );
    // canPerformMultipleBlock retourne false (sans skill) -> no-op
    expect(result).toBe(state);
    expect(result.pendingMultipleBlock).toBeUndefined();
  });
});
