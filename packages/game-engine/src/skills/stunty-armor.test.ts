/**
 * S27.7.1 — Tests pour la migration Stunty AV vers le skill-registry.
 *
 * Avant S27.7.1, `mechanics/blocking.ts:141` testait
 * `hasSkill(victim, 'stunty')` directement pour appliquer le -1 AV.
 * Apres S27.7.1, le malus passe par `collectModifiers(victim,
 * 'on-armor', ctx)` et le registry discrimine dodge vs armor via
 * `ctx.currentTrigger`.
 */
import { describe, it, expect } from "vitest";
import type { GameState, Player } from "../core/types";
import {
  collectModifiers,
  getSkillEffect,
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

describe("S27.7.1 — Stunty AV via registry", () => {
  it("Stunty est enregistre avec on-dodge ET on-armor", () => {
    const effect = getSkillEffect("stunty");
    expect(effect).toBeDefined();
    expect(effect?.triggers).toContain("on-dodge");
    expect(effect?.triggers).toContain("on-armor");
  });

  it("collectModifiers on-armor retourne -1 pour un Stunty", () => {
    const victim = makePlayer({ skills: ["stunty"] });
    const mods = collectModifiers(victim, "on-armor", { state: FAKE_STATE });
    expect(mods.armorModifier).toBe(-1);
  });

  it("collectModifiers on-armor retourne 0 (vide) pour un non-Stunty", () => {
    const victim = makePlayer({ skills: [] });
    const mods = collectModifiers(victim, "on-armor", { state: FAKE_STATE });
    expect(mods.armorModifier).toBeUndefined();
  });

  it("collectModifiers on-dodge retourne +1 pour un Stunty", () => {
    const player = makePlayer({ skills: ["stunty"] });
    const mods = collectModifiers(player, "on-dodge", { state: FAKE_STATE });
    expect(mods.dodgeModifier).toBe(1);
    expect(mods.armorModifier).toBeUndefined();
  });

  it("collectModifiers on-dodge n'applique pas de armor mod", () => {
    const player = makePlayer({ skills: ["stunty"] });
    const mods = collectModifiers(player, "on-dodge", { state: FAKE_STATE });
    expect(mods.armorModifier).toBeUndefined();
  });

  it("collectModifiers on-armor n'applique pas de dodge mod", () => {
    const victim = makePlayer({ skills: ["stunty"] });
    const mods = collectModifiers(victim, "on-armor", { state: FAKE_STATE });
    expect(mods.dodgeModifier).toBeUndefined();
  });

  it("Stunty + autre skill cumule sur on-armor (Stunty -1 reste isole)", () => {
    // Joueur qui n'a que Stunty : aucun autre skill ne contribue a -1 AV
    // sur on-armor — on s'assure qu'on ne capte pas accidentellement
    // d'autres modifiers (regression test).
    const victim = makePlayer({ skills: ["stunty", "block"] });
    const mods = collectModifiers(victim, "on-armor", { state: FAKE_STATE });
    expect(mods.armorModifier).toBe(-1);
  });

  it("currentTrigger est rempli par collectModifiers", () => {
    // Sentinelle : un getModifiers custom recoit bien `currentTrigger`.
    const probe = getSkillEffect("stunty");
    expect(probe).toBeDefined();
    // Appel direct avec currentTrigger explicite : le branche armor
    // doit etre prise.
    const armorMods = probe!.getModifiers!({
      player: makePlayer({ skills: ["stunty"] }),
      state: FAKE_STATE,
      currentTrigger: "on-armor",
    });
    expect(armorMods.armorModifier).toBe(-1);
    expect(armorMods.dodgeModifier).toBeUndefined();

    const dodgeMods = probe!.getModifiers!({
      player: makePlayer({ skills: ["stunty"] }),
      state: FAKE_STATE,
      currentTrigger: "on-dodge",
    });
    expect(dodgeMods.dodgeModifier).toBe(1);
    expect(dodgeMods.armorModifier).toBeUndefined();
  });
});
