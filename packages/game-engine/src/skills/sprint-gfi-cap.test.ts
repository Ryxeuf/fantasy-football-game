/**
 * S27.7.2 — Tests pour la migration Sprint (+1 GFI cap) vers le
 * skill-registry, et pour le helper `getGfiCap`.
 *
 * Avant S27.7.2 :
 *  - `tactical-indicators.ts:36` : `2 - (player.gfiUsed ?? 0)`
 *  - `core/game-state.ts:935`    : `(player.gfiUsed ?? 0) < 2`
 *  - `core/game-state.ts:959`    : idem
 *  - `skill-registry.ts:454`     : `Sprint => { movementModifier: 1 }`
 *    (trompeur, jamais consomme)
 *
 * Apres S27.7.2 :
 *  - Sprint expose `gfiCapBonus: 1` sur le trigger `on-gfi`.
 *  - `getGfiCap(state, player)` agrege le bonus via `collectModifiers`.
 *  - Les 3 call-sites consomment `getGfiCap`.
 */
import { describe, it, expect } from "vitest";
import type { GameState, Player } from "../core/types";
import { collectModifiers, getSkillEffect } from "./skill-registry";
import { getGfiCap } from "../core/game-state";

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

describe("S27.7.2 — Sprint GFI cap via registry", () => {
  it("Sprint expose gfiCapBonus: 1 (et plus movementModifier)", () => {
    const effect = getSkillEffect("sprint");
    expect(effect).toBeDefined();
    expect(effect?.triggers).toContain("on-gfi");

    // Le getModifiers retourne maintenant gfiCapBonus, pas
    // movementModifier (regression test contre le bug initial : la
    // valeur n'etait jamais consommee).
    const player = makePlayer({ skills: ["sprint"] });
    const mods = effect!.getModifiers!({
      player,
      state: FAKE_STATE,
      currentTrigger: "on-gfi",
    });
    expect(mods.gfiCapBonus).toBe(1);
    expect(mods.movementModifier).toBeUndefined();
  });

  it("collectModifiers on-gfi propage gfiCapBonus pour un Sprint", () => {
    const player = makePlayer({ skills: ["sprint"] });
    const mods = collectModifiers(player, "on-gfi", { state: FAKE_STATE });
    expect(mods.gfiCapBonus).toBe(1);
  });

  it("collectModifiers on-gfi est vide pour un non-Sprint", () => {
    const player = makePlayer({ skills: [] });
    const mods = collectModifiers(player, "on-gfi", { state: FAKE_STATE });
    expect(mods.gfiCapBonus).toBeUndefined();
  });
});

describe("getGfiCap", () => {
  it("retourne 2 pour un joueur sans Sprint", () => {
    const player = makePlayer({ skills: [] });
    expect(getGfiCap(FAKE_STATE, player)).toBe(2);
  });

  it("retourne 3 pour un joueur Sprint", () => {
    const player = makePlayer({ skills: ["sprint"] });
    expect(getGfiCap(FAKE_STATE, player)).toBe(3);
  });

  it("retourne 2 si Sprint absent meme avec d'autres skills", () => {
    const player = makePlayer({ skills: ["block", "sure-feet"] });
    expect(getGfiCap(FAKE_STATE, player)).toBe(2);
  });

  it("ne se cumule pas si Sprint enregistre une seule fois", () => {
    // Defensif : un joueur qui a 'sprint' une seule fois doit avoir
    // cap = 3. Si jamais collectModifiers itere sur les skills et que
    // le joueur a accidentellement deux entrees 'sprint', le bonus
    // serait double — verifions qu'il reste +1 quand 1 occurence.
    const player = makePlayer({ skills: ["sprint", "block"] });
    expect(getGfiCap(FAKE_STATE, player)).toBe(3);
  });

  it("supporte les variantes de slug (sure-feet ne casse pas le cap)", () => {
    // Sure Feet est sur on-gfi mais ne touche pas a gfiCapBonus :
    // cap reste a 2 (Sure Feet = relance, pas +1 GFI).
    const player = makePlayer({ skills: ["sure-feet"] });
    expect(getGfiCap(FAKE_STATE, player)).toBe(2);
  });

  it("respecte rulesConfig.enableGFI=false (mode simplified)", () => {
    // BUG fix : avant, getGfiCap ignorait rulesConfig et retournait
    // toujours 2 même en mode simplified (enableGFI=false, maxGFI=0).
    const player = makePlayer({ skills: ["sprint"] });
    const simplifiedState = {
      rulesConfig: { enableGFI: false, maxGFI: 0 },
    } as unknown as GameState;
    expect(getGfiCap(simplifiedState, player)).toBe(0);
  });

  it("base cap suit rulesConfig.maxGFI (extensible par skill)", () => {
    // maxGFI=2 (full) + Sprint=+1 → 3
    const sprintPlayer = makePlayer({ skills: ["sprint"] });
    const fullState = {
      rulesConfig: { enableGFI: true, maxGFI: 2 },
    } as unknown as GameState;
    expect(getGfiCap(fullState, sprintPlayer)).toBe(3);

    // Si jamais maxGFI=1 dans une rulesConfig custom, Sprint donne 2.
    const reducedState = {
      rulesConfig: { enableGFI: true, maxGFI: 1 },
    } as unknown as GameState;
    expect(getGfiCap(reducedState, sprintPlayer)).toBe(2);
  });
});
