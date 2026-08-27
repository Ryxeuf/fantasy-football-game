/**
 * Catalogue de rosters côté web (audit statique vs base — lot 5, W2/W3/W10).
 * Le nom et le budget viennent de l'API ; le catalogue compilé n'est que le
 * repli.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./api-client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "./api-client";
import {
  fetchRosterCatalog,
  invalidateRosterCatalogCache,
  resolveRosterName,
} from "./roster-catalog";

const request = apiRequest as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  invalidateRosterCatalogCache();
});

describe("fetchRosterCatalog", () => {
  it("sert les rosters de l'API pour la langue et l'édition demandées", async () => {
    request.mockResolvedValue({
      rosters: [{ slug: "human", name: "Humans", budget: 1200 }],
    });

    const list = await fetchRosterCatalog("en", "season_2");

    expect(request).toHaveBeenCalledWith(
      "/api/rosters?lang=en&ruleset=season_2",
    );
    expect(list).toEqual([
      { slug: "human", name: "Humans", budget: 1200, tier: null, naf: null },
    ]);
  });

  it("ne recharge pas un couple langue × édition déjà en cache", async () => {
    request.mockResolvedValue({ rosters: [] });
    await fetchRosterCatalog("fr", "season_3");
    await fetchRosterCatalog("fr", "season_3");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("recharge pour une autre édition", async () => {
    request.mockResolvedValue({ rosters: [] });
    await fetchRosterCatalog("fr", "season_3");
    await fetchRosterCatalog("fr", "season_2");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("réseau en échec -> liste vide (les appelants replient sur le moteur)", async () => {
    request.mockRejectedValue(new Error("offline"));
    await expect(fetchRosterCatalog()).resolves.toEqual([]);
  });
});

describe("resolveRosterName", () => {
  it("préfère le nom servi par la base", () => {
    const bySlug = new Map([["human", { name: "Humains (corrigé)" }]]);
    expect(resolveRosterName(bySlug, "human")).toBe("Humains (corrigé)");
  });

  it("retombe sur le catalogue compilé pour un slug absent", () => {
    expect(resolveRosterName(new Map(), "human")).toBe("Humains");
  });

  it("retombe sur le slug brut pour un roster inconnu partout", () => {
    expect(resolveRosterName(new Map(), "roster_maison")).toBe("roster_maison");
  });

  it("slug vide -> chaîne vide", () => {
    expect(resolveRosterName(new Map(), null)).toBe("");
    expect(resolveRosterName(new Map(), undefined)).toBe("");
  });
});
