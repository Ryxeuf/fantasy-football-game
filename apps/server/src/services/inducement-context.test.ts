/**
 * Contexte de Coups de Pouce résolu en base (audit statique vs base — lot 4,
 * S10/S11). Le match en ligne et le match local partaient d'un contexte vide
 * (`regionalRules: []`, pas de `specialRules`) : remises perdues, plafonds
 * majorés ignorés, coups de pouce conditionnels refusés à toutes les équipes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

vi.mock("../utils/roster-helpers", () => ({
  getDeclaredRegionalRules: vi.fn(),
}));

vi.mock("../utils/team-values", () => ({
  resolveSpecialRulesForTeam: vi.fn(),
}));

vi.mock("../utils/star-player-repository", () => ({
  getAvailableStarPlayersDb: vi.fn(),
}));

// Lot 6.1 — le catalogue de Coups de Pouce vient de la base ; ce fichier
// teste la RÉSOLUTION du contexte, pas le repository (couvert à part).
vi.mock("./inducement-repository", () => ({
  loadInducementCatalogue: vi.fn(),
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  canPurchaseInducement,
  getInducementCost,
  getInducementMaxQuantity,
  INDUCEMENT_CATALOGUE,
} from "@bb/game-engine";
import { getDeclaredRegionalRules } from "../utils/roster-helpers";
import { resolveSpecialRulesForTeam } from "../utils/team-values";
import { getAvailableStarPlayersDb } from "../utils/star-player-repository";
import { loadInducementCatalogue } from "./inducement-repository";
import { buildInducementContext } from "./inducement-context";

const declared = getDeclaredRegionalRules as unknown as ReturnType<typeof vi.fn>;
const special = resolveSpecialRulesForTeam as unknown as ReturnType<
  typeof vi.fn
>;
const starsDb = getAvailableStarPlayersDb as unknown as ReturnType<typeof vi.fn>;
const catalogueDb = loadInducementCatalogue as unknown as ReturnType<
  typeof vi.fn
>;

beforeEach(() => {
  vi.resetAllMocks();
  declared.mockResolvedValue(null);
  special.mockResolvedValue([]);
  starsDb.mockResolvedValue([]);
  catalogueDb.mockResolvedValue(INDUCEMENT_CATALOGUE);
});

describe("buildInducementContext", () => {
  it("résout les règles spéciales de l'équipe (remise Pots-de-vin)", async () => {
    special.mockResolvedValue(["chantage_et_corruption"]);

    const ctx = await buildInducementContext({
      teamId: "A",
      rosterSlug: "goblin",
      ruleset: "season_3",
      regionalLeague: null,
      hasApothecary: false,
    });

    expect(ctx.specialRules).toContain("chantage_et_corruption");
    // Remise officielle : 50 000 po au lieu de 100 000.
    expect(getInducementCost("bribe", ctx)).toBe(50_000);
    // Plafond majoré : 0-6 au lieu de 0-3.
    expect(getInducementMaxQuantity("bribe", ctx)).toBe(6);
  });

  it("ouvre les coups de pouce conditionnels que le contexte vide refusait", async () => {
    special.mockResolvedValue(["maitres_de_la_non_vie"]);

    const ctx = await buildInducementContext({
      teamId: "B",
      rosterSlug: "necromantic_horror",
      ruleset: "season_3",
      hasApothecary: false,
    });

    const mortuary = INDUCEMENT_CATALOGUE.find(
      (i) => i.slug === "mortuary_assistant",
    )!;
    expect(canPurchaseInducement(mortuary, ctx)).toBe(true);
    // Contexte vide (l'ancien comportement) : refusé.
    expect(
      canPurchaseInducement(mortuary, {
        teamId: "B",
        regionalRules: [],
        hasApothecary: false,
        rosterSlug: "necromantic_horror",
      }),
    ).toBe(false);
  });

  it("tient compte de la Ligue régionale CHOISIE par l'équipe", async () => {
    declared.mockResolvedValue(["underworld_challenge", "elven_kingdoms_league"]);

    const ctx = await buildInducementContext({
      teamId: "A",
      rosterSlug: "skaven",
      ruleset: "season_3",
      regionalLeague: "underworld_challenge",
      hasApothecary: false,
    });

    expect(ctx.regionalRules).toContain("underworld_challenge");
    expect(ctx.regionalRules).not.toContain("elven_kingdoms_league");
  });

  it("porte le catalogue de Star Players lu en base et son coût admin", async () => {
    starsDb.mockResolvedValue([
      { slug: "morg_n_thorg", cost: 380_000 },
      { slug: "griff_oberwald", cost: 280_000 },
    ]);

    const ctx = await buildInducementContext({
      teamId: "A",
      rosterSlug: "human",
      ruleset: "season_3",
      hasApothecary: true,
    });

    expect(getInducementCost("star_player", ctx, "morg_n_thorg")).toBe(380_000);
    // Absent du catalogue résolu ⇒ non engageable.
    expect(getInducementCost("star_player", ctx, "hakflem_skuttlespike")).toBe(
      0,
    );
  });

  it("propage le ruleset de l'équipe", async () => {
    const ctx = await buildInducementContext({
      teamId: "A",
      rosterSlug: "human",
      ruleset: "season_2",
      hasApothecary: false,
    });
    expect(ctx.ruleset).toBe("season_2");
  });

  it("dégrade sans lever quand la base est injoignable", async () => {
    declared.mockRejectedValue(new Error("no db"));

    const ctx = await buildInducementContext({
      teamId: "A",
      rosterSlug: "human",
      ruleset: "season_3",
      hasApothecary: true,
    });

    expect(ctx.regionalRules).toEqual([]);
    expect(ctx.hasApothecary).toBe(true);
    expect(ctx.starPlayers).toBeUndefined();
  });

  it("roster vide : contexte neutre, aucune lecture", async () => {
    const ctx = await buildInducementContext({
      teamId: "B",
      rosterSlug: "",
      hasApothecary: false,
    });
    expect(ctx.regionalRules).toEqual([]);
    expect(declared).not.toHaveBeenCalled();
  });
});
