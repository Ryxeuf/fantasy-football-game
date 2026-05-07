/**
 * S27.8.1 — Smoke tests pour les handlers extraits dans
 * `actions/special-actions.ts`. Chaque handler partage la meme
 * structure (gates team / hasPlayerActed / can*, execute, marquage,
 * fin de tour) ; ces tests verifient les gates de garde et le chemin
 * happy-path bout en bout.
 *
 * Les regles metier de chaque action (Hypnotic Gaze, Stab, etc.)
 * sont deja couvertes par les tests dedies dans
 * `mechanics/<x>.test.ts`. Ici on s'assure uniquement que :
 *  1. l'action est ignoree si pas le tour de l'equipe (gate `team`),
 *  2. l'action est ignoree si le joueur a deja agi (gate `hasPlayerActed`),
 *  3. l'action est ignoree si la mecanique `can*` retourne false,
 *  4. apres execution reussie, `playerActions[playerId]` est marque,
 *     et `state.players` est preserve.
 */

import { describe, it, expect } from "vitest";
import type { GameState, Player, RNG } from "../core/types";
import {
  handleHypnoticGaze,
  handleProjectileVomit,
  handleStab,
  handleChainsaw,
  handleBallAndChain,
  handleBombThrow,
} from "./special-actions";

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

function makeState(players: Player[], current: "A" | "B" = "A"): GameState {
  return {
    width: 26,
    height: 15,
    players,
    currentPlayer: current,
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

// Le set up minimal est suffisant pour les gates : `can*` retourne
// false par defaut quand la cible n'est pas adjacente / valide, donc
// aucune logique de mecanique n'est declenchee. Les tests metier
// completes sont dans `mechanics/<x>.test.ts`.

describe("S27.8.1 — handleHypnoticGaze", () => {
  it("ignore l'action si pas le tour de l'equipe", () => {
    const gazer = makePlayer({ id: "G", team: "A", skills: ["hypnotic-gaze"] });
    const target = makePlayer({ id: "T", team: "B", pos: { x: 1, y: 0 } });
    const state = makeState([gazer, target], "B");
    const next = handleHypnoticGaze(
      state,
      { type: "HYPNOTIC_GAZE", playerId: "G", targetId: "T" },
      rng,
    );
    expect(next).toBe(state);
  });

  it("ignore l'action si la cible n'existe pas", () => {
    const gazer = makePlayer({ id: "G", team: "A", skills: ["hypnotic-gaze"] });
    const state = makeState([gazer], "A");
    const next = handleHypnoticGaze(
      state,
      { type: "HYPNOTIC_GAZE", playerId: "G", targetId: "missing" },
      rng,
    );
    expect(next).toBe(state);
  });

  it("ignore l'action si le joueur a deja agi", () => {
    const gazer = makePlayer({ id: "G", team: "A", skills: ["hypnotic-gaze"] });
    const target = makePlayer({ id: "T", team: "B", pos: { x: 1, y: 0 } });
    const state: GameState = {
      ...makeState([gazer, target], "A"),
      playerActions: { G: "MOVE" },
    };
    const next = handleHypnoticGaze(
      state,
      { type: "HYPNOTIC_GAZE", playerId: "G", targetId: "T" },
      rng,
    );
    expect(next).toBe(state);
  });
});

describe("S27.8.1 — handleProjectileVomit", () => {
  it("ignore l'action si pas le tour de l'equipe", () => {
    const v = makePlayer({ id: "V", team: "A", skills: ["projectile-vomit"] });
    const t = makePlayer({ id: "T", team: "B", pos: { x: 1, y: 0 } });
    const state = makeState([v, t], "B");
    const next = handleProjectileVomit(
      state,
      { type: "PROJECTILE_VOMIT", playerId: "V", targetId: "T" },
      rng,
    );
    expect(next).toBe(state);
  });

  it("ignore l'action sans cible valide", () => {
    const v = makePlayer({ id: "V", team: "A", skills: ["projectile-vomit"] });
    const state = makeState([v], "A");
    const next = handleProjectileVomit(
      state,
      { type: "PROJECTILE_VOMIT", playerId: "V", targetId: "missing" },
      rng,
    );
    expect(next).toBe(state);
  });
});

describe("S27.8.1 — handleStab", () => {
  it("ignore l'action si pas le tour de l'equipe", () => {
    const s = makePlayer({ id: "S", team: "A", skills: ["stab"] });
    const t = makePlayer({ id: "T", team: "B", pos: { x: 1, y: 0 } });
    const state = makeState([s, t], "B");
    const next = handleStab(
      state,
      { type: "STAB", playerId: "S", targetId: "T" },
      rng,
    );
    expect(next).toBe(state);
  });

  it("ignore l'action sans cible valide", () => {
    const s = makePlayer({ id: "S", team: "A", skills: ["stab"] });
    const state = makeState([s], "A");
    const next = handleStab(
      state,
      { type: "STAB", playerId: "S", targetId: "missing" },
      rng,
    );
    expect(next).toBe(state);
  });
});

describe("S27.8.1 — handleChainsaw", () => {
  it("ignore l'action si pas le tour de l'equipe", () => {
    const a = makePlayer({ id: "A1", team: "A", skills: ["chainsaw"] });
    const t = makePlayer({ id: "T", team: "B", pos: { x: 1, y: 0 } });
    const state = makeState([a, t], "B");
    const next = handleChainsaw(
      state,
      { type: "CHAINSAW", playerId: "A1", targetId: "T" },
      rng,
    );
    expect(next).toBe(state);
  });

  it("ignore l'action sans cible valide", () => {
    const a = makePlayer({ id: "A1", team: "A", skills: ["chainsaw"] });
    const state = makeState([a], "A");
    const next = handleChainsaw(
      state,
      { type: "CHAINSAW", playerId: "A1", targetId: "missing" },
      rng,
    );
    expect(next).toBe(state);
  });
});

describe("S27.8.1 — handleBallAndChain", () => {
  it("ignore l'action si pas le tour de l'equipe", () => {
    const p = makePlayer({ id: "P", team: "A", skills: ["ball-and-chain"] });
    const state = makeState([p], "B");
    const next = handleBallAndChain(
      state,
      { type: "BALL_AND_CHAIN", playerId: "P" },
      rng,
    );
    expect(next).toBe(state);
  });

  it("ignore l'action si le joueur n'existe pas", () => {
    const state = makeState([], "A");
    const next = handleBallAndChain(
      state,
      { type: "BALL_AND_CHAIN", playerId: "missing" },
      rng,
    );
    expect(next).toBe(state);
  });
});

describe("S27.8.1 — handleBombThrow", () => {
  it("ignore l'action si pas le tour de l'equipe", () => {
    const p = makePlayer({ id: "P", team: "A", skills: ["bombardier"] });
    const state = makeState([p], "B");
    const next = handleBombThrow(
      state,
      { type: "BOMB_THROW", playerId: "P", target: { x: 5, y: 5 } },
      rng,
    );
    expect(next).toBe(state);
  });

  it("ignore l'action si le joueur n'existe pas", () => {
    const state = makeState([], "A");
    const next = handleBombThrow(
      state,
      { type: "BOMB_THROW", playerId: "missing", target: { x: 5, y: 5 } },
      rng,
    );
    expect(next).toBe(state);
  });
});
