/**
 * `buildTeamBudgetSummary` / `creditInitialTreasury`.
 *
 * Régression couverte : la fiche d'équipe affichait un « Budget restant »
 * recalculé côté web (10K) face à une trésorerie à 0, parce que le reliquat
 * du budget de construction n'était jamais crédité et que le coût des
 * joueurs était re-dérivé sans les surcoûts d'avancement.
 */

import { describe, it, expect, vi } from "vitest";
import {
  buildTeamBudgetSummary,
  creditInitialTreasury,
  dedicatedFansPurchaseCost,
  syncDraftTreasury,
} from "./team-budget-summary";

interface FakeTeam {
  id: string;
  roster: string;
  ruleset: string;
  format: string;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  initialBudget: number;
  treasury: number;
}

function team(overrides: Partial<FakeTeam> = {}): FakeTeam {
  return {
    id: "team-1",
    // Roster/positions inconnus du catalogue : coût de repli 50 000 po,
    // stable quel que soit le contenu du game-engine.
    roster: "roster-inconnu-test",
    ruleset: "season_3",
    format: "bb11",
    rerolls: 0,
    cheerleaders: 0,
    assistants: 0,
    apothecary: false,
    dedicatedFans: 1,
    initialBudget: 1000,
    treasury: 0,
    ...overrides,
  };
}

function players(count: number, advancements = "[]") {
  return Array.from({ length: count }, () => ({
    position: "position-inconnue-test",
    advancements,
    dead: false,
    firedAt: null,
    missNextMatch: false,
  }));
}

/** Client Prisma étroit : seul `skill.findMany` est requis (élite). */
function db(elite: string[] = []) {
  return {
    skill: { findMany: vi.fn().mockResolvedValue(elite.map((slug) => ({ slug }))) },
  } as unknown;
}

describe("dedicatedFansPurchaseCost", () => {
  it("offre le premier fan et facture les suivants", () => {
    expect(dedicatedFansPurchaseCost(1, 5_000)).toBe(0);
    expect(dedicatedFansPurchaseCost(3, 5_000)).toBe(10_000);
    expect(dedicatedFansPurchaseCost(0, 5_000)).toBe(0);
  });
});

describe("buildTeamBudgetSummary", () => {
  it("détaille les postes et le reliquat en po", async () => {
    const summary = await buildTeamBudgetSummary(
      db(),
      team({ rerolls: 2, dedicatedFans: 3 }),
      players(11),
      [],
    );

    // 11 × 50k joueurs, 2 relances (défaut roster inconnu), 2 fans payants.
    expect(summary.playersCost).toBe(550_000);
    expect(summary.initialBudget).toBe(1_000_000);
    expect(summary.dedicatedFansCost).toBe(10_000);
    expect(summary.totalSpent).toBe(
      summary.playersCost +
        summary.starPlayersCost +
        summary.staffCost +
        summary.rerollsCost +
        summary.dedicatedFansCost,
    );
    expect(summary.remaining).toBe(
      summary.initialBudget - summary.totalSpent,
    );
    // Les fans dévoués ne comptent pas dans la VE.
    expect(summary.teamValue).toBe(
      summary.playersCost + summary.staffCost + summary.rerollsCost,
    );
  });

  it("compte les Star Players au budget mais pas dans la VE", async () => {
    const summary = await buildTeamBudgetSummary(db(), team(), players(11), [
      { cost: 250_000 },
    ]);

    expect(summary.starPlayersCost).toBe(250_000);
    expect(summary.totalSpent).toBe(550_000 + 250_000);
    expect(summary.teamValue).toBe(550_000);
  });

  it("compte les surcoûts d'avancement dans le coût des joueurs", async () => {
    const withSkill = JSON.stringify([{ type: "primary", skillSlug: "block" }]);
    const summary = await buildTeamBudgetSummary(
      db(),
      team(),
      [...players(10), ...players(1, withSkill)],
      [],
    );

    // 11 × 50k + une compétence primaire (20k) — c'est précisément ce que
    // le calcul web ignorait.
    expect(summary.playersCost).toBe(550_000 + 20_000);
  });
});

describe("creditInitialTreasury", () => {
  function prismaFor(t: FakeTeam, playerRows = players(11)) {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      team: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ ...t, players: playerRows, starPlayers: [] }),
        update,
      },
      skill: { findMany: vi.fn().mockResolvedValue([]) },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { prisma: prisma as any, update };
  }

  it("crédite le reliquat du budget de construction", async () => {
    const { prisma, update } = prismaFor(team({ rerolls: 2, dedicatedFans: 3 }));

    const credited = await creditInitialTreasury(prisma, "team-1");

    // 1 000k − (550k joueurs + 2 relances + 10k fans)
    expect(credited).toBeGreaterThan(0);
    expect(update).toHaveBeenCalledWith({
      where: { id: "team-1" },
      data: { treasury: credited },
    });
  });

  it("ne touche pas une trésorerie déjà non nulle", async () => {
    const { prisma, update } = prismaFor(team({ treasury: 42_000 }));

    await expect(creditInitialTreasury(prisma, "team-1")).resolves.toBe(42_000);
    expect(update).not.toHaveBeenCalled();
  });

  it("ne crédite rien quand le budget est entièrement dépensé", async () => {
    const { prisma, update } = prismaFor(
      team({ initialBudget: 550 }),
      players(11),
    );

    await expect(creditInitialTreasury(prisma, "team-1")).resolves.toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("syncDraftTreasury", () => {
  function prismaFor(t: FakeTeam, playerRows = players(11)) {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      team: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ ...t, players: playerRows, starPlayers: [] }),
        update,
      },
      skill: { findMany: vi.fn().mockResolvedValue([]) },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { prisma: prisma as any, update };
  }

  it("ramène une trésorerie fantôme au reliquat réel du budget", async () => {
    // Cas prod : 505k crédités à la création (11 joueurs bon marché), puis
    // roster complété jusqu'au budget sans débit → reliquat réel 0.
    const { prisma, update } = prismaFor(
      team({ initialBudget: 550, treasury: 505_000 }),
      players(11),
    );

    await expect(syncDraftTreasury(prisma, "team-1")).resolves.toBe(0);
    expect(update).toHaveBeenCalledWith({
      where: { id: "team-1" },
      data: { treasury: 0 },
    });
  });

  it("recrédite le reliquat quand le brouillon dépense moins", async () => {
    // 1 000k − 550k joueurs = 450k, quelle que soit la trésorerie courante.
    const { prisma, update } = prismaFor(team({ treasury: 0 }), players(11));

    await expect(syncDraftTreasury(prisma, "team-1")).resolves.toBe(450_000);
    expect(update).toHaveBeenCalledWith({
      where: { id: "team-1" },
      data: { treasury: 450_000 },
    });
  });

  it("ne descend jamais sous zéro quand le brouillon dépasse le budget", async () => {
    const { prisma, update } = prismaFor(
      team({ initialBudget: 500, treasury: 30_000 }),
      players(11),
    );

    await expect(syncDraftTreasury(prisma, "team-1")).resolves.toBe(0);
    expect(update).toHaveBeenCalledWith({
      where: { id: "team-1" },
      data: { treasury: 0 },
    });
  });

  it("n'écrit rien quand la trésorerie est déjà juste", async () => {
    const { prisma, update } = prismaFor(team({ treasury: 450_000 }), players(11));

    await expect(syncDraftTreasury(prisma, "team-1")).resolves.toBe(450_000);
    expect(update).not.toHaveBeenCalled();
  });

  it("retourne 0 sans écrire pour une équipe introuvable", async () => {
    const { prisma, update } = prismaFor(team());
    prisma.team.findUnique.mockResolvedValue(null);

    await expect(syncDraftTreasury(prisma, "team-x")).resolves.toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
