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

import { NAF_WORLD_CUP_2027, getSpecialRulesForTeam } from "@bb/game-engine";
import { resolveSpecialRulesForTeam } from "../utils/team-values";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import { inducementOptionsFor } from "./inducement-options";

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
