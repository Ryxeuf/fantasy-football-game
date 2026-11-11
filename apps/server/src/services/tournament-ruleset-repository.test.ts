/**
 * La base prime, le registre du moteur reste le filet : une table vide, une
 * base injoignable ou une ligne au JSON corrompu ne doivent jamais priver
 * l'application d'un règlement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("../prisma", () => ({
  prisma: { tournamentRuleset: { findMany: (a: unknown) => findMany(a) } },
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import {
  NAF_WORLD_CUP_2027,
  NAF_WORLD_CUP_2027_V3,
  TOURNAMENT_RULESET_SLUGS,
} from "@bb/game-engine";
import { serializeDefinition } from "../schemas/tournament-ruleset.schemas";
import {
  getTournamentRulesetDefinition,
  invalidateTournamentRulesetCache,
  isKnownTournamentRuleset,
  listTournamentRulesets,
  tournamentRulesetShortLabel,
} from "./tournament-ruleset-repository";

/** Ligne de base valide, dérivée du registre. */
function row(over: Record<string, unknown> = {}) {
  return {
    slug: "naf_world_cup_2027",
    enabled: true,
    definition: serializeDefinition(NAF_WORLD_CUP_2027),
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  invalidateTournamentRulesetCache();
});

describe("repli sur le registre du moteur", () => {
  it("table vide : le registre est servi", async () => {
    findMany.mockResolvedValue([]);
    const list = await listTournamentRulesets();
    expect(list.map((r) => r.slug)).toEqual([...TOURNAMENT_RULESET_SLUGS]);
    expect(list.every((r) => r.source === "engine")).toBe(true);
    expect(list[0].definition).toEqual(NAF_WORLD_CUP_2027);
    // Le pack V3.0 est servi dès le déploiement, avant tout seed.
    expect(list[1].definition).toEqual(NAF_WORLD_CUP_2027_V3);
  });

  it("base injoignable : le registre est servi", async () => {
    findMany.mockRejectedValue(new Error("relation does not exist"));
    const list = await listTournamentRulesets();
    expect(list.map((r) => r.slug)).toEqual([...TOURNAMENT_RULESET_SLUGS]);
    expect(list.every((r) => r.source === "engine")).toBe(true);
  });

  it("ligne au JSON invalide : la ligne est ignorée, le moteur prend le relais", async () => {
    findMany.mockResolvedValue([
      row({ definition: { slug: "naf_world_cup_2027", nameFr: "" } }),
    ]);
    const list = await listTournamentRulesets();
    const v21 = list.filter((r) => r.slug === "naf_world_cup_2027");
    expect(v21).toHaveLength(1);
    expect(v21[0].source).toBe("engine");
    expect(v21[0].definition).toEqual(NAF_WORLD_CUP_2027);
  });
});

describe("la base prime", () => {
  it("sert la définition éditée en base", async () => {
    const edited = serializeDefinition({
      ...NAF_WORLD_CUP_2027,
      shortLabel: "NAF WC 2027 (maison)",
    });
    findMany.mockResolvedValue([row({ definition: edited })]);
    const list = await listTournamentRulesets();
    expect(list[0].source).toBe("db");
    expect(list[0].definition.shortLabel).toBe("NAF WC 2027 (maison)");
  });

  it("le slug de la ligne fait foi sur celui du JSON", async () => {
    // Sécurité anti-dérive : c'est la colonne que référencent les équipes.
    findMany.mockResolvedValue([
      row({
        slug: "coupe_maison",
        definition: serializeDefinition(NAF_WORLD_CUP_2027),
      }),
    ]);
    const def = await getTournamentRulesetDefinition("coupe_maison");
    expect(def?.slug).toBe("coupe_maison");
  });

  it("ajoute les règlements du moteur absents de la base", async () => {
    findMany.mockResolvedValue([row({ slug: "coupe_maison" })]);
    const list = await listTournamentRulesets();
    expect(list.map((r) => r.slug).sort()).toEqual([
      "coupe_maison",
      "naf_world_cup_2027",
      "naf_world_cup_2027_v3",
    ]);
  });
});

describe("règlements désactivés", () => {
  it("exclus des listes de création", async () => {
    findMany.mockResolvedValue([row({ enabled: false })]);
    // Désactiver le V2.1 ne retire que lui : le V3.0 reste proposé.
    expect((await listTournamentRulesets()).map((r) => r.slug)).toEqual([
      "naf_world_cup_2027_v3",
    ]);
    invalidateTournamentRulesetCache();
    findMany.mockResolvedValue([row({ enabled: false })]);
    expect(
      (await listTournamentRulesets({ includeDisabled: true })).map((r) => r.slug),
    ).toEqual(["naf_world_cup_2027", "naf_world_cup_2027_v3"]);
  });

  it("restent résolvables par slug (équipes déjà créées)", async () => {
    findMany.mockResolvedValue([row({ enabled: false })]);
    expect(await isKnownTournamentRuleset("naf_world_cup_2027")).toBe(true);
    expect(
      (await getTournamentRulesetDefinition("naf_world_cup_2027"))?.slug,
    ).toBe("naf_world_cup_2027");
  });
});

describe("helpers", () => {
  it("slug inconnu", async () => {
    findMany.mockResolvedValue([]);
    expect(await getTournamentRulesetDefinition("inconnu")).toBeNull();
    expect(await isKnownTournamentRuleset("inconnu")).toBe(false);
    expect(await getTournamentRulesetDefinition(null)).toBeNull();
  });

  it("libellé court, repli sur le slug", async () => {
    findMany.mockResolvedValue([]);
    expect(await tournamentRulesetShortLabel("naf_world_cup_2027")).toBe(
      NAF_WORLD_CUP_2027.shortLabel,
    );
    expect(await tournamentRulesetShortLabel("inconnu")).toBe("inconnu");
    expect(await tournamentRulesetShortLabel(null)).toBeNull();
  });
});
