/**
 * Liste fermée et prix imposés des coups de pouce sous règlement de tournoi.
 */

import { describe, it, expect } from "vitest";
import { NAF_WORLD_CUP_2027 } from "@bb/game-engine";
import {
  applyPackInducementRules,
  effectiveInducementAllowlist,
  hasSecretWeapon,
  resolveCupInducementList,
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

describe("applyPackInducementRules — remises et plafond du règlement", () => {
  const CHEF: InducementOptionLike = {
    slug: "halfling_master_chef",
    name: "Chef Cuistot Halfling",
    cost: 300_000,
    maxQuantity: 1,
    description: "Vole des relances.",
  };
  // Option déjà résolue pour une équipe Chantage et Corruption (goblin) :
  // le catalogue lui sert 50 000 po et 6 au plus.
  const GOBLIN_BRIBE: InducementOptionLike = {
    slug: "bribe",
    name: "Pot-de-vin",
    cost: 50_000,
    maxQuantity: 6,
    description: "Corrompre l'arbitre.",
  };
  const qualifies = (slugs: string[]) => (slug: string) => slugs.includes(slug);

  it("goblin (Chantage et Corruption) : Pots-de-vin à 50 000 po, jusqu'à 6", () => {
    const [bribe] = applyPackInducementRules([GOBLIN_BRIBE], NAF_WORLD_CUP_2027, {
      qualifiesForDiscount: qualifies(["bribe"]),
    });
    expect(bribe).toMatchObject({ cost: 50_000, maxQuantity: 6 });
  });

  it("halfling : Chef Cuistot à 100 000 po, 300 000 pour toute autre équipe", () => {
    const [halflingChef] = applyPackInducementRules([CHEF], NAF_WORLD_CUP_2027, {
      qualifiesForDiscount: qualifies(["halfling_master_chef"]),
    });
    expect(halflingChef.cost).toBe(100_000);
    const [otherChef] = applyPackInducementRules([CHEF], NAF_WORLD_CUP_2027, {
      qualifiesForDiscount: qualifies([]),
    });
    expect(otherChef.cost).toBe(300_000);
  });

  it("une équipe sans remise paie le prix du règlement", () => {
    const [bribe] = applyPackInducementRules(
      [{ ...GOBLIN_BRIBE, cost: 100_000, maxQuantity: 3 }],
      NAF_WORLD_CUP_2027,
    );
    expect(bribe).toMatchObject({ cost: 100_000, maxQuantity: 3 });
  });

  it("un Star Player à Arme Secrète abaisse les Pots-de-vin à 2", () => {
    const [bribe] = applyPackInducementRules([GOBLIN_BRIBE], NAF_WORLD_CUP_2027, {
      qualifiesForDiscount: qualifies(["bribe"]),
      hasSecretWeaponStar: true,
    });
    expect(bribe.maxQuantity).toBe(2);
  });

  it("le plafond Arme Secrète ne touche que les coups de pouce qui en portent un", () => {
    const kegs: InducementOptionLike = {
      slug: "bloodweiser_kegs",
      name: "Fûts",
      cost: 50_000,
      maxQuantity: 2,
      description: "",
    };
    const [out] = applyPackInducementRules([kegs], NAF_WORLD_CUP_2027, {
      hasSecretWeaponStar: true,
    });
    expect(out.maxQuantity).toBe(2);
  });
});

describe("hasSecretWeapon", () => {
  it("lit Arme Secrète dans le CSV de compétences d'un Star Player", () => {
    expect(hasSecretWeapon("loner-4, secret-weapon,stunty")).toBe(true);
    expect(hasSecretWeapon("block,dodge")).toBe(false);
    expect(hasSecretWeapon(null)).toBe(false);
  });
});

describe("resolveCupInducementList — la liste du commissaire fait foi", () => {
  const PACK_SLUGS = NAF_WORLD_CUP_2027.allowedInducements.map((r) => r.slug);

  it("sans liste : celle du règlement, sinon tout le catalogue", () => {
    expect(resolveCupInducementList(null, NAF_WORLD_CUP_2027)).toEqual({
      allowed: PACK_SLUGS,
      extras: [],
    });
    expect(resolveCupInducementList(null, null)).toEqual({
      allowed: null,
      extras: [],
    });
  });

  it("retire un coup de pouce du règlement", () => {
    const list = PACK_SLUGS.filter((s) => s !== "bribe");
    const out = resolveCupInducementList(list, NAF_WORLD_CUP_2027);
    expect(out.allowed).not.toContain("bribe");
    expect(out.extras).toEqual([]);
  });

  it("ajoute un coup de pouce que le règlement ne liste pas", () => {
    const out = resolveCupInducementList(
      ["team_mascot", "weather_mage"],
      NAF_WORLD_CUP_2027,
    );
    expect(out).toEqual({
      allowed: ["team_mascot", "weather_mage"],
      extras: ["weather_mage"],
    });
  });

  it("liste vide explicite : aucun coup de pouce", () => {
    expect(resolveCupInducementList([], NAF_WORLD_CUP_2027)).toEqual({
      allowed: [],
      extras: [],
    });
  });

  it("sans règlement, rien n'est un ajout", () => {
    expect(resolveCupInducementList(["weather_mage"], null)).toEqual({
      allowed: ["weather_mage"],
      extras: [],
    });
  });

  it("les Star Players ne relèvent pas de la liste", () => {
    expect(
      resolveCupInducementList(["star_player", "team_mascot"], null).allowed,
    ).toEqual(["team_mascot"]);
  });
});

describe("applyPackInducementRules — ajouts de la compétition", () => {
  const WEATHER: InducementOptionLike = {
    slug: "weather_mage",
    name: "Mage Météo",
    cost: 30_000,
    maxQuantity: 1,
    description: "Change la météo.",
  };

  it("un ajout passe au prix et au plafond du catalogue", () => {
    const out = applyPackInducementRules(
      [...CATALOGUE, WEATHER],
      NAF_WORLD_CUP_2027,
      {},
      ["weather_mage"],
    );
    expect(out.find((o) => o.slug === "weather_mage")).toEqual(WEATHER);
    // Le reste du règlement est inchangé : prix du règlement, hors-liste retiré.
    expect(out.find((o) => o.slug === "bribe")?.cost).toBe(100_000);
    expect(out.some((o) => o.slug === "wandering_apothecary")).toBe(false);
  });

  it("sans ajout, la liste du règlement reste fermée (ligues)", () => {
    const out = applyPackInducementRules([...CATALOGUE, WEATHER], NAF_WORLD_CUP_2027);
    expect(out.some((o) => o.slug === "weather_mage")).toBe(false);
  });
});
