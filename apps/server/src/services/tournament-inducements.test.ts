/**
 * Liste fermée et prix imposés des coups de pouce sous règlement de tournoi.
 */

import { describe, it, expect } from "vitest";
import { NAF_WORLD_CUP_2027 } from "@bb/game-engine";
import {
  applyPackInducementRules,
  effectiveInducementAllowlist,
  type InducementOptionLike,
} from "./tournament-inducements";

const CATALOGUE: InducementOptionLike[] = [
  {
    slug: "bribe",
    name: "Pot-de-vin",
    cost: 50_000,
    maxQuantity: 3,
    description: "Corrompre l'arbitre.",
  },
  {
    slug: "bloodweiser_kegs",
    name: "Fût de Bloodweiser",
    cost: 50_000,
    maxQuantity: 3,
    description: "De quoi remettre les KO d'aplomb.",
  },
  {
    slug: "wandering_apothecary",
    name: "Apothicaire itinérant",
    cost: 100_000,
    maxQuantity: 2,
    description: "Un apothicaire de plus.",
  },
  {
    slug: "star_player",
    name: "Star Player",
    cost: 0,
    maxQuantity: 2,
    description: "Recrutement de Star Player.",
  },
];

describe("effectiveInducementAllowlist", () => {
  it("sans règlement ni allowlist, aucune restriction", () => {
    expect(effectiveInducementAllowlist(null, null)).toBeNull();
  });

  it("sans règlement, l'allowlist de la ligue est conservée", () => {
    expect(effectiveInducementAllowlist(["bribe"], null)).toEqual(["bribe"]);
  });

  it("le règlement pose une liste fermée", () => {
    const allowed = effectiveInducementAllowlist(null, NAF_WORLD_CUP_2027);
    expect(allowed).toEqual(
      NAF_WORLD_CUP_2027.allowedInducements.map((r) => r.slug),
    );
    expect(allowed).not.toContain("wandering_apothecary");
  });

  it("intersecte règlement et allowlist de ligue", () => {
    expect(
      effectiveInducementAllowlist(
        ["bribe", "wandering_apothecary"],
        NAF_WORLD_CUP_2027,
      ),
    ).toEqual(["bribe"]);
  });
});

describe("applyPackInducementRules", () => {
  it("sans règlement, le catalogue est servi tel quel", () => {
    expect(applyPackInducementRules(CATALOGUE, null)).toEqual(CATALOGUE);
  });

  it("retire ce que le règlement n'autorise pas, sauf les Star Players", () => {
    const out = applyPackInducementRules(CATALOGUE, NAF_WORLD_CUP_2027);
    const slugs = out.map((o) => o.slug);
    expect(slugs).toContain("bribe");
    expect(slugs).toContain("star_player");
    expect(slugs).not.toContain("wandering_apothecary");
  });

  it("impose le prix et la quantité du règlement", () => {
    const out = applyPackInducementRules(CATALOGUE, NAF_WORLD_CUP_2027);
    const bribe = out.find((o) => o.slug === "bribe");
    // 100 000 po dans le pack, contre 50 000 au catalogue.
    expect(bribe?.cost).toBe(100_000);
    const kegs = out.find((o) => o.slug === "bloodweiser_kegs");
    expect(kegs?.cost).toBe(50_000);
    expect(kegs?.maxQuantity).toBe(2);
  });

  it("complète la description avec la précision du règlement", () => {
    const out = applyPackInducementRules(CATALOGUE, NAF_WORLD_CUP_2027);
    const bribe = out.find((o) => o.slug === "bribe");
    expect(bribe?.description).toContain("Corrompre l'arbitre.");
    expect(bribe?.description).toContain("NAF World Cup 2027");
    expect(bribe?.description).toMatch(/50 000 po pour les équipes/);
  });
});
