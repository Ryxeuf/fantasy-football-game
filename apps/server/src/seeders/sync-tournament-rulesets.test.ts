/**
 * Le seed amorce la base depuis le registre du moteur SANS jamais écraser une
 * correction saisie en admin — sauf demande explicite (`force`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
vi.mock("../prisma", () => ({
  prisma: {
    tournamentRuleset: {
      findUnique: (a: unknown) => findUnique(a),
      create: (a: unknown) => create(a),
      update: (a: unknown) => update(a),
    },
  },
}));
vi.mock("../services/tournament-ruleset-repository", () => ({
  invalidateTournamentRulesetCache: vi.fn(),
}));

import { syncTournamentRulesets } from "./sync-tournament-rulesets";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("syncTournamentRulesets", () => {
  it("dry-run par défaut : annonce sans écrire", async () => {
    findUnique.mockResolvedValue(null);
    const res = await syncTournamentRulesets();
    expect(res.write).toBe(false);
    expect(res.created).toContain("naf_world_cup_2027");
    expect(create).not.toHaveBeenCalled();
  });

  it("crée les règlements absents", async () => {
    findUnique.mockResolvedValue(null);
    const res = await syncTournamentRulesets({ write: true });
    expect(res.created).toContain("naf_world_cup_2027");
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.slug).toBe("naf_world_cup_2027");
    expect(data.enabled).toBe(true);
    // Sérialisé pour JSON : la borne ouverte est stockée null, pas Infinity.
    expect(JSON.stringify(data.definition)).toContain('"maxTotalCostK":null');
  });

  it("laisse intacte une ligne déjà présente", async () => {
    findUnique.mockResolvedValue({ id: "r1" });
    const res = await syncTournamentRulesets({ write: true });
    expect(res.skipped).toContain("naf_world_cup_2027");
    expect(res.created).toEqual([]);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("force : réécrit depuis le registre", async () => {
    findUnique.mockResolvedValue({ id: "r1" });
    const res = await syncTournamentRulesets({ write: true, force: true });
    expect(res.updated).toContain("naf_world_cup_2027");
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].where).toEqual({
      slug: "naf_world_cup_2027",
    });
  });

  it("limite l'opération à un slug", async () => {
    findUnique.mockResolvedValue(null);
    const res = await syncTournamentRulesets({ slug: "inconnu" });
    expect(res.created).toEqual([]);
    expect(res.skipped).toEqual([]);
  });

  it("une ligne créée porte les remises et le plafond Arme Secrète du registre", async () => {
    findUnique.mockResolvedValue(null);
    await syncTournamentRulesets({ write: true });
    const bribe = create.mock.calls[0][0].data.definition.allowedInducements.find(
      (r: { slug: string }) => r.slug === "bribe",
    );
    expect(bribe).toMatchObject({
      cost: 100_000,
      discountCost: 50_000,
      maxWithSecretWeaponStar: 2,
    });
  });

  it("une ligne éditée en admin ne reçoit pas les nouveaux champs sans force", async () => {
    findUnique.mockResolvedValue({ id: "r1" });
    await syncTournamentRulesets({ write: true });
    expect(update).not.toHaveBeenCalled();
  });

  it("force : la réinitialisation apporte les nouveaux champs", async () => {
    findUnique.mockResolvedValue({ id: "r1" });
    await syncTournamentRulesets({ write: true, force: true });
    const chef = update.mock.calls[0][0].data.definition.allowedInducements.find(
      (r: { slug: string }) => r.slug === "halfling_master_chef",
    );
    expect(chef).toMatchObject({ cost: 300_000, discountCost: 100_000 });
  });
});
