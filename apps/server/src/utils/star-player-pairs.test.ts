/**
 * Lot G — paires obligatoires de Star Players.
 *
 * Non-régression du bug qui a motivé le lot : la table des paires vivait en
 * dur dans trois fichiers, et celle utilisée par `validateStarPlayerPairs`
 * ignorait Dribl & Drull. On pouvait donc composer une équipe avec Dribl seul.
 *
 * Lot 6.3 — la relation est maintenant lue en base
 * (`StarPlayer.pairWithSlug`), le catalogue `@bb/game-engine` servant de
 * repli. Ce fichier verrouille les DEUX chemins : la base vide doit continuer
 * à refuser une demi-paire (repli), et une paire éditée en admin doit primer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStarPlayerPair } from "@bb/game-engine";

vi.mock("../prisma", () => ({
  prisma: { starPlayer: { findMany: vi.fn() } },
}));

vi.mock("./server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

import { prisma } from "../prisma";
import {
  validateStarPlayerPairs,
  requiresPair,
} from "./star-player-validation";

const mockPrisma = prisma as unknown as {
  starPlayer: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.resetAllMocks();
  // Table vide par défaut ⇒ repli sur le catalogue compilé.
  mockPrisma.starPlayer.findMany.mockResolvedValue([]);
});

describe("paires obligatoires de Star Players — repli catalogue (S3)", () => {
  it.each([
    ["grak", "crumbleberry", 250000],
    ["crumbleberry", "grak", 250000],
    ["dribl", "drull", 230000],
    ["drull", "dribl", 230000],
    ["lucien_swift", "valen_swift", 300000],
    ["valen_swift", "lucien_swift", 300000],
  ])("%s s'associe à %s pour %i po", async (slug, partner, pairCost) => {
    const pair = getStarPlayerPair(slug, "season_3");
    expect(pair?.partnerSlug).toBe(partner);
    expect(pair?.pairCost).toBe(pairCost);
    await expect(requiresPair(slug, "season_3")).resolves.toBe(partner);
  });

  it("un star player sans paire ne réclame pas de partenaire", async () => {
    expect(getStarPlayerPair("mighty_zug", "season_3")).toBeNull();
    await expect(requiresPair("mighty_zug", "season_3")).resolves.toBeNull();
  });

  it("Drull s'associe à Dribl, pas à Grak", () => {
    expect(getStarPlayerPair("drull", "season_3")?.partnerSlug).toBe("dribl");
  });

  it("rejette Dribl sans Drull (cas ignoré par la table câblée)", async () => {
    const result = await validateStarPlayerPairs(["dribl"], "season_3");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Drull");
  });

  it("accepte une paire complète", async () => {
    await expect(
      validateStarPlayerPairs(["dribl", "drull"], "season_3"),
    ).resolves.toMatchObject({ valid: true });
    await expect(
      validateStarPlayerPairs(["grak", "crumbleberry"], "season_3"),
    ).resolves.toMatchObject({ valid: true });
  });

  it("rejette un jumeau Swift seul", async () => {
    await expect(
      validateStarPlayerPairs(["valen_swift"], "season_3"),
    ).resolves.toMatchObject({ valid: false });
  });

  it("la relation reste connue en Saison 2 (prix S2 recalculé)", async () => {
    const pair = getStarPlayerPair("crumbleberry", "season_2");
    expect(pair?.partnerSlug).toBe("grak");
    // S2 non touchée : le prix est la somme des coûts S2 (250 + 0).
    expect(pair?.pairCost).toBe(250000);
    await expect(
      validateStarPlayerPairs(["grak"], "season_2"),
    ).resolves.toMatchObject({ valid: false });
  });
});

describe("paires obligatoires — la base fait foi (lot 6.3)", () => {
  it("applique une paire créée en admin, absente du catalogue compilé", async () => {
    mockPrisma.starPlayer.findMany.mockResolvedValue([
      {
        slug: "mighty_zug",
        displayName: "Mighty Zug",
        cost: 200000,
        pairWithSlug: "morg_n_thorg",
      },
      {
        slug: "morg_n_thorg",
        displayName: "Morg'n'Thorg",
        cost: 380000,
        pairWithSlug: "mighty_zug",
      },
    ]);

    await expect(requiresPair("mighty_zug", "season_3")).resolves.toBe(
      "morg_n_thorg",
    );
    const result = await validateStarPlayerPairs(["mighty_zug"], "season_3");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Morg'n'Thorg");
  });

  it("dérive le prix de la paire de la somme des coûts EN BASE", async () => {
    mockPrisma.starPlayer.findMany.mockResolvedValue([
      { slug: "grak", displayName: "Grak", cost: 190000, pairWithSlug: null },
      {
        slug: "crumbleberry",
        displayName: "Crumbleberry",
        cost: 0,
        pairWithSlug: null,
      },
    ]);

    // `pairWithSlug` nul ⇒ la RELATION vient du catalogue, mais le PRIX est
    // recalculé depuis la base : un coût corrigé en admin se propage.
    const { getStarPlayerPairDb } = await import("./star-player-repository");
    await expect(getStarPlayerPairDb("grak", "season_3")).resolves.toMatchObject(
      { partnerSlug: "crumbleberry", pairCost: 190000 },
    );
  });
});
