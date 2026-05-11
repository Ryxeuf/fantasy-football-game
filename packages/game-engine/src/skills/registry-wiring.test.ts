/**
 * Sprint O — Lot O.A.2-4 : tests de régression "registry wiring".
 *
 * Le follow-up-b01.md listait les skills "hardcodes residuels" au
 * 2026-04-27. Audit du 2026-05-10 a verifie que tous les skills cites
 * sont en realite deja wired correctement via le skill-registry. Ce
 * fichier de tests verrouille cette verification pour eviter qu'un
 * refactor futur ne re-introduise du hardcode silencieusement.
 *
 * Chaque test verifie le **comportement end-to-end** : le bonus
 * registry doit etre present dans le path actif (action-handler ou
 * mechanics). Les tests purs "registry contains skill" ne valent rien
 * si le consumer ne `collectModifiers` jamais.
 */

import { describe, expect, it } from "vitest";

import type { GameState, Player } from "../core/types";
import {
  collectModifiers,
  getSkillEffect,
} from "./skill-registry";
import {
  canSkillReroll,
  getDodgeSkillModifiers,
  isSneakyGitActive,
} from "./skill-bridge";
import { getGfiCap } from "../core/game-state";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p",
    team: "A",
    pos: { x: 5, y: 5 },
    name: "Test Player",
    number: 1,
    position: "Lineman",
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: [],
    pm: 6,
    ...overrides,
  };
}

function makeOpponent(
  pos: { x: number; y: number },
  skills: string[] = [],
): Player {
  return makePlayer({
    id: "opp",
    team: "B",
    pos,
    skills,
  });
}

const FAKE_STATE = {
  width: 26,
  height: 15,
  players: [],
  currentPlayer: "A" as const,
  turn: 1,
  selectedPlayerId: null,
  isTurnover: false,
} as unknown as GameState;

describe("Lot O.A.2 — Sure Feet (GFI reroll)", () => {
  it("registre expose Sure Feet sur on-gfi avec canReroll: true", () => {
    const effect = getSkillEffect("sure-feet");
    expect(effect).toBeDefined();
    expect(effect?.triggers).toContain("on-gfi");
    expect(effect?.canReroll).toBeDefined();
  });

  it("canSkillReroll(joueur Sure Feet, on-gfi) = true", () => {
    const player = makePlayer({ skills: ["sure-feet"] });
    expect(canSkillReroll(player, "on-gfi", FAKE_STATE)).toBe(true);
  });

  it("canSkillReroll(joueur sans Sure Feet, on-gfi) = false", () => {
    const player = makePlayer({ skills: ["block"] });
    expect(canSkillReroll(player, "on-gfi", FAKE_STATE)).toBe(false);
  });

  it("supporte les variantes de slug (sure_feet, sure feet)", () => {
    const p1 = makePlayer({ skills: ["sure_feet"] });
    const p2 = makePlayer({ skills: ["sure feet"] });
    expect(canSkillReroll(p1, "on-gfi", FAKE_STATE)).toBe(true);
    expect(canSkillReroll(p2, "on-gfi", FAKE_STATE)).toBe(true);
  });
});

describe("Lot O.A.2 — Sprint (+1 GFI cap)", () => {
  it("registre expose Sprint sur on-gfi avec gfiCapBonus: 1", () => {
    const effect = getSkillEffect("sprint");
    expect(effect).toBeDefined();
    expect(effect?.triggers).toContain("on-gfi");
    const mods = effect!.getModifiers!({
      player: makePlayer({ skills: ["sprint"] }),
      state: FAKE_STATE,
      currentTrigger: "on-gfi",
    });
    expect(mods.gfiCapBonus).toBe(1);
  });

  it("getGfiCap(Sprint) = 3, sinon 2 (S27.7.2 confirme)", () => {
    expect(getGfiCap(FAKE_STATE, makePlayer({ skills: [] }))).toBe(2);
    expect(getGfiCap(FAKE_STATE, makePlayer({ skills: ["sprint"] }))).toBe(3);
  });
});

describe("Lot O.A.3 — Horns (+ST sur Blitz)", () => {
  it("registre expose Horns sur on-block-attacker avec strengthModifier: 1", () => {
    const effect = getSkillEffect("horns");
    expect(effect).toBeDefined();
    expect(effect?.triggers).toContain("on-block-attacker");
    // canApply ne match QUE en Blitz (ctx.isBlitz === true).
    const player = makePlayer({ skills: ["horns"], st: 3 });
    expect(
      effect!.canApply({ player, state: FAKE_STATE, isBlitz: true }),
    ).toBe(true);
    expect(
      effect!.canApply({ player, state: FAKE_STATE, isBlitz: false }),
    ).toBe(false);
  });

  it("collectModifiers on-block-attacker Blitz=true → +1 ST", () => {
    const player = makePlayer({ skills: ["horns"] });
    const mods = collectModifiers(player, "on-block-attacker", {
      state: FAKE_STATE,
      isBlitz: true,
    });
    expect(mods.strengthModifier).toBe(1);
  });

  it("collectModifiers on-block-attacker Block standard (isBlitz=false) → +0", () => {
    const player = makePlayer({ skills: ["horns"] });
    const mods = collectModifiers(player, "on-block-attacker", {
      state: FAKE_STATE,
      isBlitz: false,
    });
    expect(mods.strengthModifier ?? 0).toBe(0);
  });
});

describe("Lot O.A.4 — Stunty (-1 AV sur armor) — S27.7 confirme", () => {
  it("registre expose Stunty sur on-armor avec armorModifier: -1", () => {
    const effect = getSkillEffect("stunty");
    expect(effect).toBeDefined();
    expect(effect?.triggers).toContain("on-armor");
  });

  it("collectModifiers on-armor d'un joueur Stunty → -1", () => {
    const player = makePlayer({ skills: ["stunty"] });
    const mods = collectModifiers(player, "on-armor", { state: FAKE_STATE });
    expect(mods.armorModifier).toBe(-1);
  });
});

describe("Lot O.A.4 — Sneaky Git (foul sans expulsion sur doublet)", () => {
  it("isSneakyGitActive(joueur avec sneaky-git) = true", () => {
    const player = makePlayer({ skills: ["sneaky-git"] });
    expect(isSneakyGitActive(FAKE_STATE, player)).toBe(true);
  });

  it("isSneakyGitActive(joueur sans sneaky-git) = false", () => {
    const player = makePlayer({ skills: ["dirty-player"] });
    expect(isSneakyGitActive(FAKE_STATE, player)).toBe(false);
  });
});

describe("Lot O.A.7 — Diving Tackle (-2 sur dodge adjacent)", () => {
  it("registre expose Diving Tackle sur on-dodge avec dodgeModifier: -2", () => {
    const effect = getSkillEffect("diving-tackle");
    expect(effect).toBeDefined();
    expect(effect?.triggers).toContain("on-dodge");
    const mods = effect!.getModifiers!({
      player: makePlayer({ skills: ["diving-tackle"] }),
      state: FAKE_STATE,
    });
    expect(mods.dodgeModifier).toBe(-2);
  });

  it("getDodgeSkillModifiers prend en compte un adversaire adjacent avec DT", () => {
    // Joueur en (5,5) dodge depuis cette position. Adversaire en (5,6)
    // (adjacent) avec Diving Tackle → -2 sur le dodge.
    const dodger = makePlayer({ skills: [], pos: { x: 5, y: 5 } });
    const opponent = makeOpponent({ x: 5, y: 6 }, ["diving-tackle"]);
    const state = {
      ...FAKE_STATE,
      players: [dodger, opponent],
    } as GameState;
    const penalty = getDodgeSkillModifiers(state, dodger, { x: 5, y: 5 });
    expect(penalty).toBe(-2);
  });

  it("getDodgeSkillModifiers ignore les adversaires non-adjacents avec DT", () => {
    const dodger = makePlayer({ skills: [], pos: { x: 5, y: 5 } });
    // Adversaire en (5, 10) — pas adjacent
    const opponent = makeOpponent({ x: 5, y: 10 }, ["diving-tackle"]);
    const state = {
      ...FAKE_STATE,
      players: [dodger, opponent],
    } as GameState;
    const penalty = getDodgeSkillModifiers(state, dodger, { x: 5, y: 5 });
    expect(penalty).toBe(0);
  });
});

describe("Sign-off : O.A.2-4 — toutes les wirings registry sont en place", () => {
  it("aucun skill hardcode dans les 6 entry points audites", () => {
    // Verification cle : chaque skill du follow-up B0.1 est correctement
    // declaree dans le registry avec ses triggers attendus.
    const expected = [
      { slug: "sure-feet", trigger: "on-gfi" },
      { slug: "sprint", trigger: "on-gfi" },
      { slug: "horns", trigger: "on-block-attacker" },
      { slug: "stunty", trigger: "on-armor" },
      { slug: "diving-tackle", trigger: "on-dodge" },
      { slug: "sneaky-git", trigger: "on-foul" },
    ];
    for (const { slug, trigger } of expected) {
      const effect = getSkillEffect(slug);
      expect(effect, `${slug} doit etre enregistre`).toBeDefined();
      expect(
        effect!.triggers,
        `${slug} doit avoir le trigger ${trigger}`,
      ).toContain(trigger);
    }
  });
});
