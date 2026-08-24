/**
 * Tests de `updateTeamValues` — la règle VEA :
 *
 *   VE  = valeur de tous les joueurs du roster actif (morts/licenciés
 *         exclus) + staff + relances ;
 *   VEA = VE − valeur des joueurs ABSENTS (missNextMatch), qui ratent
 *         le prochain match.
 *
 * Le bug historique : `available` était codé en dur à `true`, donc
 * VEA === VE quel que soit l'état du roster.
 */

import { describe, it, expect, vi } from "vitest";
import { updateTeamValues } from "./team-values";

interface FakePlayer {
  position: string;
  advancements: string;
  dead: boolean;
  firedAt: Date | null;
  missNextMatch: boolean;
}

function player(overrides: Partial<FakePlayer> = {}): FakePlayer {
  return {
    // Position inconnue du catalogue -> coût fallback 50 000 po, stable
    // pour le test quel que soit le contenu du game-engine.
    position: "position-inconnue-test",
    advancements: "[]",
    dead: false,
    firedAt: null,
    missNextMatch: false,
    ...overrides,
  };
}

function buildPrisma(players: FakePlayer[], eliteSlugs: string[] = ["block"]) {
  const update = vi.fn().mockResolvedValue({});
  const prisma = {
    team: {
      findUnique: vi.fn().mockResolvedValue({
        id: "team-1",
        roster: "roster-inconnu-test",
        ruleset: "season_3",
        players,
        rerolls: 0,
        cheerleaders: 0,
        assistants: 0,
        apothecary: false,
        // Les fans dévoués ne comptent ni dans la VE ni dans la VEA.
        dedicatedFans: 1,
      }),
      update,
    },
    skill: {
      findMany: vi
        .fn()
        .mockResolvedValue(eliteSlugs.map((slug) => ({ slug }))),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { prisma: prisma as any, update };
}

describe("updateTeamValues — VEA = VE - joueurs absents", () => {
  it("exclut les joueurs missNextMatch de la VEA mais pas de la VE", async () => {
    const { prisma, update } = buildPrisma([
      player(),
      player({ missNextMatch: true }),
    ]);
    const out = await updateTeamValues(prisma, "team-1");
    // 2×50k joueurs (les fans ne comptent pas) ; VEA : l'absent (50k) en moins.
    expect(out).toEqual({ teamValue: 100_000, currentValue: 50_000 });
    expect(update).toHaveBeenCalledWith({
      where: { id: "team-1" },
      data: { teamValue: 100_000, currentValue: 50_000 },
    });
  });

  it("VEA === VE quand aucun joueur n'est absent", async () => {
    const { prisma } = buildPrisma([player(), player()]);
    const out = await updateTeamValues(prisma, "team-1");
    expect(out.teamValue).toBe(100_000);
    expect(out.currentValue).toBe(100_000);
  });

  it("exclut morts et licenciés des DEUX valeurs", async () => {
    const { prisma } = buildPrisma([
      player(),
      player({ dead: true }),
      player({ firedAt: new Date("2026-08-01") }),
    ]);
    const out = await updateTeamValues(prisma, "team-1");
    expect(out.teamValue).toBe(50_000);
    expect(out.currentValue).toBe(50_000);
  });

  it("le surcoût d'avancement d'un joueur absent compte dans la VE mais pas la VEA", async () => {
    const { prisma } = buildPrisma([
      player(),
      player({
        missNextMatch: true,
        // +20 000 po de surcoût (compétence primaire choisie).
        advancements: JSON.stringify([{ type: "primary" }]),
      }),
    ]);
    const out = await updateTeamValues(prisma, "team-1");
    expect(out.teamValue).toBe(120_000);
    expect(out.currentValue).toBe(50_000);
  });

  it("une compétence Élite coûte 30 000 po (20k + 10k), pas 20 000", async () => {
    const { prisma } = buildPrisma([
      player({
        advancements: JSON.stringify([
          { type: "primary", skillSlug: "block" }, // Élite -> +30k
          { type: "primary", skillSlug: "tackle" }, // non-Élite -> +20k
        ]),
      }),
    ]);
    const out = await updateTeamValues(prisma, "team-1");
    // 50k base + 30k (Élite) + 20k = 100k.
    expect(out.teamValue).toBe(100_000);
    expect(out.currentValue).toBe(100_000);
    // Le référentiel Élite est requêté sur le ruleset de l'équipe.
    expect(prisma.skill.findMany).toHaveBeenCalledWith({
      where: { isElite: true, ruleset: "season_3" },
      select: { slug: true },
    });
  });

  it("reste tolérant si le modèle Skill est indisponible (pas de surcoût Élite)", async () => {
    const { prisma } = buildPrisma([
      player({
        advancements: JSON.stringify([{ type: "primary", skillSlug: "block" }]),
      }),
    ]);
    prisma.skill.findMany.mockRejectedValueOnce(new Error("no skill model"));
    const out = await updateTeamValues(prisma, "team-1");
    expect(out.teamValue).toBe(70_000);
  });
});
