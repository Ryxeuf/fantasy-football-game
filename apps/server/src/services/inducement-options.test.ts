/**
 * Catalogue effectif d'une équipe : accès apothicaire et règles spéciales
 * lus en base (mockés ici), remises du catalogue, liste de la compétition et
 * règlement de tournoi.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));
vi.mock("../utils/team-values", () => ({
  resolveSpecialRulesForTeam: vi.fn(),
}));
vi.mock("../utils/roster-helpers", () => ({
  getDeclaredRegionalRules: vi.fn(async () => null),
}));
vi.mock("./roster-staff-config", () => ({
  resolveStaffConfigBySlug: vi.fn(),
}));
vi.mock("./inducement-repository", () => ({
  loadInducementCatalogue: vi.fn(async () => undefined),
}));
vi.mock("../utils/star-player-repository", () => ({
  getStarPlayerBySlugDb: vi.fn(),
}));

import { NAF_WORLD_CUP_2027, getSpecialRulesForTeam } from "@bb/game-engine";
import { resolveSpecialRulesForTeam } from "../utils/team-values";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import {
  buildInducementCatalogue,
  inducementOptionsFor,
} from "./inducement-options";
import { getStarPlayerBySlugDb } from "../utils/star-player-repository";

const staff = resolveStaffConfigBySlug as unknown as ReturnType<typeof vi.fn>;
const specialRules = resolveSpecialRulesForTeam as unknown as ReturnType<
  typeof vi.fn
>;

beforeEach(() => {
  staff.mockResolvedValue({ apothecaryAllowed: true });
  specialRules.mockImplementation(
    async (_db: unknown, roster: string, ruleset: string) =>
      getSpecialRulesForTeam(roster, ruleset as never),
  );
});

const slugs = (options: { slug: string }[]) => options.map((o) => o.slug);

describe("inducementOptionsFor", () => {
  it("apothicaire autorisé : l'Apothicaire Ambulant est proposé", async () => {
    const out = await inducementOptionsFor("human", "season_3");
    expect(slugs(out)).toContain("wandering_apothecary");
    expect(slugs(out)).not.toContain("star_player");
  });

  it("apothicaire interdit en base : l'Apothicaire Ambulant disparaît", async () => {
    staff.mockResolvedValue({ apothecaryAllowed: false });
    const out = await inducementOptionsFor("human", "season_3");
    expect(slugs(out)).not.toContain("wandering_apothecary");
  });

  it("liste de la compétition : seuls les slugs autorisés restent", async () => {
    const out = await inducementOptionsFor("human", "season_3", [
      "team_mascot",
    ]);
    expect(slugs(out)).toEqual(["team_mascot"]);
  });

  it("règlement : liste fermée, remise du catalogue et plafond Arme Secrète", async () => {
    const out = await inducementOptionsFor(
      "goblin",
      "season_3",
      null,
      null,
      NAF_WORLD_CUP_2027,
      { hasSecretWeaponStar: true },
    );
    expect(slugs(out)).not.toContain("weather_mage");
    expect(out.find((o) => o.slug === "bribe")).toMatchObject({
      cost: 50_000,
      maxQuantity: 2,
    });
  });
});

describe("buildInducementCatalogue", () => {
  const star = getStarPlayerBySlugDb as unknown as ReturnType<typeof vi.fn>;

  it("règlement NAF : les 5 coups de pouce du pack accessibles au roster", async () => {
    const out = await buildInducementCatalogue({
      roster: "snotling",
      ruleset: "season_3",
      pack: NAF_WORLD_CUP_2027,
    });
    // Snotlings : Débutants Déchaînés (Trois-quarts à vil prix) compris.
    expect(slugs(out).sort()).toEqual([
      "bloodweiser_kegs",
      "bribe",
      "halfling_master_chef",
      "riotous_rookies",
      "team_mascot",
    ]);
  });

  it("coupe avec liste : intersection avec le catalogue", async () => {
    const out = await buildInducementCatalogue({
      roster: "human",
      ruleset: "season_3",
      allowlist: ["team_mascot", "bloodweiser_kegs", "mercenary_players"],
    });
    expect(slugs(out).sort()).toEqual(["bloodweiser_kegs", "team_mascot"]);
  });

  it("jamais de coût variable ni de Star Player", async () => {
    const out = await buildInducementCatalogue({
      roster: "human",
      ruleset: "season_3",
    });
    expect(slugs(out)).not.toContain("mercenary_players");
    expect(slugs(out)).not.toContain("star_player");
    expect(slugs(out)).toContain("team_mascot");
  });

  it("Star Player recruté à Arme Secrète : Pots-de-vin plafonnés par le règlement", async () => {
    star.mockResolvedValue({ skills: "secret-weapon,stunty" });
    const out = await buildInducementCatalogue({
      roster: "goblin",
      ruleset: "season_3",
      pack: NAF_WORLD_CUP_2027,
      hiredStarSlugs: ["bomber_dribblesnot"],
    });
    expect(out.find((o) => o.slug === "bribe")?.maxQuantity).toBe(2);
  });

  it("sans Arme Secrète : plafond du catalogue (6 pour Chantage et Corruption)", async () => {
    star.mockResolvedValue({ skills: "block" });
    const out = await buildInducementCatalogue({
      roster: "goblin",
      ruleset: "season_3",
      pack: NAF_WORLD_CUP_2027,
      hiredStarSlugs: ["griff_oberwald"],
    });
    expect(out.find((o) => o.slug === "bribe")?.maxQuantity).toBe(6);
  });
});
