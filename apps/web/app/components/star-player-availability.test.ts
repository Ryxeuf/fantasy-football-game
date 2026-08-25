/**
 * Règles de disponibilité d'un Star Player (raison du blocage).
 */
import { describe, it, expect } from "vitest";
import {
  starPlayerBlock,
  starPlayerBlockLabel,
} from "./star-player-availability";

const MORG = { slug: "morg", cost: 380_000 };
const GRIFF = { slug: "griff", cost: 280_000 };
const DRIBL = { slug: "dribl", cost: 150_000 };
const DRULL = { slug: "drull", cost: 100_000 };
const CATALOG = [MORG, GRIFF, DRIBL, DRULL];
const PAIRS = { dribl: "drull", drull: "dribl" };

function base(overrides: Partial<Parameters<typeof starPlayerBlock>[0]> = {}) {
  return starPlayerBlock({
    star: GRIFF,
    catalog: CATALOG,
    selected: [],
    selectedCostPo: 0,
    availableBudgetPo: 1_000_000,
    currentPlayerCount: 11,
    maxPlayers: 16,
    pairPartners: PAIRS,
    ...overrides,
  });
}

describe("starPlayerBlock", () => {
  it("ne bloque pas un Star Player abordable", () => {
    expect(base()).toBeNull();
  });

  it("ne bloque jamais un Star Player déjà sélectionné (il doit rester décochable)", () => {
    expect(
      base({
        selected: ["griff"],
        availableBudgetPo: 0,
        currentPlayerCount: 16,
      }),
    ).toBeNull();
  });

  it("signale un Star Player banni par le règlement", () => {
    const block = base({ bannedSlugs: ["griff"] });
    expect(block?.reason).toBe("banned");
    expect(starPlayerBlockLabel(block!)).toContain("règlement");
  });

  it("signale un budget insuffisant avec les montants", () => {
    const block = base({ availableBudgetPo: 200_000 });
    expect(block?.reason).toBe("budget");
    expect(block?.requiredPo).toBe(280_000);
    expect(block?.availablePo).toBe(200_000);
    expect(starPlayerBlockLabel(block!)).toBe(
      "Budget insuffisant : 280K po requis, 200K po disponibles",
    );
  });

  it("déduit la sélection courante du budget restant", () => {
    const block = base({
      selected: ["morg"],
      selectedCostPo: 380_000,
      availableBudgetPo: 500_000,
    });
    expect(block?.reason).toBe("budget");
    expect(block?.availablePo).toBe(120_000);
  });

  it("signale le plafond de joueurs atteint", () => {
    const block = base({ currentPlayerCount: 16 });
    expect(block?.reason).toBe("roster-cap");
    expect(block?.neededSlots).toBe(1);
    expect(starPlayerBlockLabel(block!)).toContain("maximum 16 joueurs");
  });

  it("compte DEUX places pour une paire obligatoire", () => {
    // 15 joueurs + Dribl & Drull = 17 > 16 : la paire ne rentre pas, alors
    // qu'un Star Player seul passerait.
    const block = base({ star: DRIBL, currentPlayerCount: 15 });
    expect(block?.reason).toBe("roster-cap");
    expect(block?.neededSlots).toBe(2);
    expect(starPlayerBlockLabel(block!)).toContain("paire");
  });

  it("facture le coût de la paire au budget", () => {
    const block = base({ star: DRIBL, availableBudgetPo: 200_000 });
    expect(block?.reason).toBe("budget");
    expect(block?.requiredPo).toBe(250_000);
  });

  it("ne recompte pas le partenaire déjà sélectionné", () => {
    expect(
      base({
        star: DRIBL,
        selected: ["drull"],
        selectedCostPo: 100_000,
        availableBudgetPo: 260_000,
        currentPlayerCount: 14,
      }),
    ).toBeNull();
  });

  it("signale un partenaire de paire absent du catalogue servi", () => {
    const block = base({
      star: DRIBL,
      catalog: [MORG, GRIFF, DRIBL],
    });
    expect(block?.reason).toBe("pair-unavailable");
    expect(block?.partnerSlug).toBe("drull");
  });

  it("signale un partenaire de paire banni par le règlement", () => {
    const block = base({ star: DRIBL, bannedSlugs: ["drull"] });
    expect(block?.reason).toBe("pair-unavailable");
  });

  it("applique le plafond réduit du format Sevens", () => {
    const block = base({ currentPlayerCount: 11, maxPlayers: 11 });
    expect(block?.reason).toBe("roster-cap");
    expect(starPlayerBlockLabel(block!)).toContain("maximum 11 joueurs");
  });
});
