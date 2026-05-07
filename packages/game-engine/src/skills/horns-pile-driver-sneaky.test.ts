/**
 * S27.7.3 — Tests pour la migration Horns / Pile Driver / Sneaky Git
 * vers le skill-registry. Cloture le solde B0.1.
 *
 * Avant S27.7.3 :
 *  - Horns : registre `getModifiers: () => ({ strengthModifier: 1 })`
 *    sur `on-block-attacker` mais jamais consomme par `actions.ts`.
 *  - Pile Driver : trigger `on-block-attacker` sans modifier (faux
 *    positif dans `getSkillsForTrigger('on-block-attacker')`).
 *  - Sneaky Git : `core/game-state.ts` testait `hasSkill` directement
 *    en parallele du chemin registry expose par `skill-bridge`.
 *
 * Apres S27.7.3 :
 *  - Horns canApply requiert `ctx.isBlitz === true`. Consomme dans
 *    `actions.ts` via `collectModifiers(attacker, 'on-block-attacker',
 *    { state, opponent: target, isBlitz })`.
 *  - Pile Driver passe en trigger `passive` (decouverte UI uniquement).
 *  - Sneaky Git unifie via `isSneakyGitActive` partout.
 */
import { describe, it, expect } from "vitest";
import type { GameState, Player } from "../core/types";
import {
  collectModifiers,
  getSkillEffect,
  getSkillsForTrigger,
} from "./skill-registry";

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

const FAKE_STATE = {} as GameState;

describe("S27.7.3 — Horns +1 ST sur Blitz via registry", () => {
  it("Horns canApply retourne false si isBlitz n'est pas true", () => {
    const player = makePlayer({ skills: ["horns"] });
    const effect = getSkillEffect("horns")!;
    expect(effect.canApply({ player, state: FAKE_STATE })).toBe(false);
    expect(
      effect.canApply({ player, state: FAKE_STATE, isBlitz: false }),
    ).toBe(false);
    expect(
      effect.canApply({ player, state: FAKE_STATE, isBlitz: true }),
    ).toBe(true);
  });

  it("collectModifiers on-block-attacker avec isBlitz=true expose +1 ST", () => {
    const player = makePlayer({ skills: ["horns"] });
    const mods = collectModifiers(player, "on-block-attacker", {
      state: FAKE_STATE,
      isBlitz: true,
    });
    expect(mods.strengthModifier).toBe(1);
  });

  it("collectModifiers on-block-attacker sans isBlitz n'applique pas Horns", () => {
    const player = makePlayer({ skills: ["horns"] });
    const mods = collectModifiers(player, "on-block-attacker", {
      state: FAKE_STATE,
    });
    expect(mods.strengthModifier).toBeUndefined();
  });

  it("non-Horns ne contribue pas", () => {
    const player = makePlayer({ skills: ["block"] });
    const mods = collectModifiers(player, "on-block-attacker", {
      state: FAKE_STATE,
      isBlitz: true,
    });
    expect(mods.strengthModifier).toBeUndefined();
  });
});

describe("S27.7.3 — Pile Driver trigger passive", () => {
  it("Pile Driver est registre sur trigger 'passive'", () => {
    const effect = getSkillEffect("pile-driver");
    expect(effect).toBeDefined();
    expect(effect?.triggers).toEqual(["passive"]);
  });

  it("Pile Driver n'apparait plus dans getSkillsForTrigger('on-block-attacker')", () => {
    const slugs = getSkillsForTrigger("on-block-attacker").map((s) => s.slug);
    expect(slugs).not.toContain("pile-driver");
  });

  it("Pile Driver apparait dans getSkillsForTrigger('passive')", () => {
    const slugs = getSkillsForTrigger("passive").map((s) => s.slug);
    expect(slugs).toContain("pile-driver");
  });

  it("Pile Driver canApply suit hasSkill", () => {
    const effect = getSkillEffect("pile-driver")!;
    const without = makePlayer({ skills: [] });
    const withIt = makePlayer({ skills: ["pile-driver"] });
    expect(effect.canApply({ player: without, state: FAKE_STATE })).toBe(false);
    expect(effect.canApply({ player: withIt, state: FAKE_STATE })).toBe(true);
  });
});

describe("S27.7.3 — Sneaky Git isolation registry", () => {
  it("Sneaky Git est registre sur trigger 'on-foul' (pas de regression)", () => {
    const effect = getSkillEffect("sneaky-git");
    expect(effect).toBeDefined();
    expect(effect?.triggers).toContain("on-foul");
  });

  it("Sneaky Git canApply suit hasSkill (slug avec tiret ou underscore)", () => {
    const effect = getSkillEffect("sneaky-git")!;
    expect(
      effect.canApply({ player: makePlayer({ skills: [] }), state: FAKE_STATE }),
    ).toBe(false);
    expect(
      effect.canApply({
        player: makePlayer({ skills: ["sneaky-git"] }),
        state: FAKE_STATE,
      }),
    ).toBe(true);
    expect(
      effect.canApply({
        player: makePlayer({ skills: ["sneaky_git"] }),
        state: FAKE_STATE,
      }),
    ).toBe(true);
  });
});
