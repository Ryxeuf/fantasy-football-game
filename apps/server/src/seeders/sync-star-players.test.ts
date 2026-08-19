/**
 * Tests du service de sync Star Players (prisma + sources game-engine mockés).
 *
 * Ce que ces tests verrouillent, dans l'ordre des risques :
 *  - DRY-RUN (`write: false`) : ZÉRO écriture, mais le diff champ par champ
 *    (c'est aussi le script de contrôle « 0 écart ») ;
 *  - WRITE : update des champs de règles + relink complet skills/ligues ;
 *  - alias de slug : une fiche dont la base porte un slug historique est
 *    CORRIGÉE, pas dupliquée (le bug qui changerait l'URL publique) ;
 *  - champs de présentation (`displayName`, `imageUrl`) jamais réécrits sur
 *    une ligne existante — les édits admin survivent au sync ;
 *  - création des lignes `Skill` manquantes, avec `excludedFromSelection`
 *    quand le slug n'est porté par aucune Position (variante star player).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    starPlayer: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    starPlayerSkill: { deleteMany: vi.fn(), create: vi.fn() },
    starPlayerHirableBy: { deleteMany: vi.fn(), create: vi.fn() },
    skill: { findUnique: vi.fn(), create: vi.fn() },
    roster: { findUnique: vi.fn() },
  },
}));

// Source de vérité figée : deux fiches, dont une (grombrindal) que la base
// porte sous un slug historique long.
vi.mock("../../../../packages/game-engine/src/rosters/star-players", () => ({
  STAR_PLAYERS_BY_RULESET: {
    season_3: {
      grombrindal: {
        slug: "grombrindal",
        displayName: "Grombrindal, the White Dwarf",
        cost: 170000,
        ma: 5,
        st: 4,
        ag: 4,
        pa: 5,
        av: 10,
        skills: "block,hate-dwarf",
        hirableBy: ["halfling_thimble_cup", "old_world_classic"],
        specialRule: "Sagesse du Nain Blanc : ...",
        imageUrl: "/data/grombrindal.webp",
        keywords: "Nain, Blitzer",
      },
      mighty_zug: {
        slug: "mighty_zug",
        displayName: "Mighty Zug",
        cost: 190000,
        ma: 5,
        st: 5,
        ag: 4,
        pa: null,
        av: 10,
        skills: "block",
        hirableBy: ["old_world_classic"],
        specialRule: "Coup Écrasant : ...",
        imageUrl: "/data/zug.webp",
        keywords: "Humain, Bloqueur",
      },
    },
  },
}));

vi.mock("../../../../packages/game-engine/src/rosters/positions", () => ({
  RULESETS: ["season_2", "season_3"],
  TEAM_ROSTERS_BY_RULESET: {
    season_3: {
      dwarf: { positions: [{ slug: "dwarf_blocker", skills: "block,thick-skull" }] },
    },
  },
}));

vi.mock("../../../../packages/game-engine/src/skills/index", () => ({
  SKILLS_DEFINITIONS: [
    { slug: "block", nameFr: "Blocage", nameEn: "Block", description: "d", descriptionEn: "d", category: "General" },
    {
      slug: "hate-dwarf",
      nameFr: "Haine (Nain)*",
      nameEn: "Hate (Dwarf)",
      description: "d",
      descriptionEn: "d",
      category: "Trait",
      isPassive: true,
    },
  ],
}));

import { prisma } from "../prisma";
import { syncStarPlayers } from "./sync-star-players";

type MockFn = ReturnType<typeof vi.fn>;
const spFindFirst = prisma.starPlayer.findFirst as MockFn;
const spUpdate = prisma.starPlayer.update as MockFn;
const spCreate = prisma.starPlayer.create as MockFn;
const spsDeleteMany = prisma.starPlayerSkill.deleteMany as MockFn;
const spsCreate = prisma.starPlayerSkill.create as MockFn;
const hbDeleteMany = prisma.starPlayerHirableBy.deleteMany as MockFn;
const hbCreate = prisma.starPlayerHirableBy.create as MockFn;
const skillFindUnique = prisma.skill.findUnique as MockFn;
const skillCreate = prisma.skill.create as MockFn;
const rosterFindUnique = prisma.roster.findUnique as MockFn;

/** Ligne en base : Grombrindal sous son slug long, avec les données fausses. */
const staleGrombrindal = {
  id: "sp-grom",
  slug: "grombrindal_the_white_dwarf",
  displayName: "Grombrindal (ancien nom admin)",
  cost: 210000,
  ma: 5,
  st: 4,
  ag: 4,
  pa: 5,
  av: 10,
  keywords: "Nain, Blitzer",
  specialRule: "vieux texte",
  imageUrl: "/data/edit-admin.webp",
  skills: [{ skill: { slug: "block" } }],
  hirableBy: [],
};

/** Ligne en base : Zug déjà parfaitement conforme au code. */
const cleanZug = {
  id: "sp-zug",
  slug: "mighty_zug",
  displayName: "Mighty Zug",
  cost: 190000,
  ma: 5,
  st: 5,
  ag: 4,
  pa: null,
  av: 10,
  keywords: "Humain, Bloqueur",
  specialRule: "Coup Écrasant : ...",
  imageUrl: "/data/zug.webp",
  skills: [{ skill: { slug: "block" } }],
  hirableBy: [{ rule: "old_world_classic" }],
};

beforeEach(() => {
  vi.resetAllMocks();
  spFindFirst.mockImplementation(async ({ where }: { where: { slug: string } }) => {
    if (where.slug === "grombrindal_the_white_dwarf") return staleGrombrindal;
    if (where.slug === "mighty_zug") return cleanZug;
    return null; // "grombrindal" court : absent en base
  });
  // `hate-dwarf` absent de la table Skill, `block` présent. Le mock reflète
  // les créations pour rester fidèle à une vraie base (une ligne créée par le
  // sync doit être retrouvable au moment du relink).
  const skillRows = new Map<string, { id: string }>([["block", { id: "skill-block" }]]);
  skillFindUnique.mockImplementation(
    async ({ where }: { where: { slug_ruleset: { slug: string } } }) =>
      skillRows.get(where.slug_ruleset.slug) ?? null,
  );
  skillCreate.mockImplementation(async ({ data }: { data: { slug: string } }) => {
    const row = { id: `skill-${data.slug}` };
    skillRows.set(data.slug, row);
    return row;
  });
  rosterFindUnique.mockResolvedValue(null);
  spUpdate.mockResolvedValue({ id: "sp-grom" });
  spCreate.mockResolvedValue({ id: "sp-new" });
});

describe("syncStarPlayers", () => {
  it("DRY-RUN : décrit le diff sans aucune écriture", async () => {
    const result = await syncStarPlayers({ write: false });

    expect(result.write).toBe(false);
    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(1);
    expect(result.created).toBe(0);

    const grom = result.players.find((p) => p.slug === "grombrindal");
    expect(grom?.action).toBe("update");
    expect(grom?.dbSlug).toBe("grombrindal_the_white_dwarf");
    expect(grom?.changes).toEqual(
      expect.arrayContaining([
        { field: "cost", from: 210000, to: 170000 },
        { field: "specialRule", from: "vieux texte", to: "Sagesse du Nain Blanc : ..." },
        { field: "skills", from: "block", to: "block,hate-dwarf" },
        { field: "hirableBy", from: "", to: "halfling_thimble_cup,old_world_classic" },
      ]),
    );

    // CRITIQUE : zéro effet de bord en dry-run.
    expect(spUpdate).not.toHaveBeenCalled();
    expect(spCreate).not.toHaveBeenCalled();
    expect(spsDeleteMany).not.toHaveBeenCalled();
    expect(hbDeleteMany).not.toHaveBeenCalled();
    expect(skillCreate).not.toHaveBeenCalled();
  });

  it("WRITE : corrige la fiche, relink compétences et ligues", async () => {
    await syncStarPlayers({ write: true });

    // Update ciblé par id, sur les seuls champs de règles.
    expect(spUpdate).toHaveBeenCalledTimes(1);
    expect(spUpdate).toHaveBeenCalledWith({
      where: { id: "sp-grom" },
      data: { cost: 170000, specialRule: "Sagesse du Nain Blanc : ..." },
    });

    // Relink intégral des compétences (2 slugs) et des ligues (2 règles).
    expect(spsDeleteMany).toHaveBeenCalledWith({ where: { starPlayerId: "sp-grom" } });
    expect(spsCreate).toHaveBeenCalledTimes(2);
    expect(hbDeleteMany).toHaveBeenCalledWith({ where: { starPlayerId: "sp-grom" } });
    expect(hbCreate).toHaveBeenCalledTimes(2);
  });

  it("ne duplique pas une fiche portant un slug historique en base", async () => {
    await syncStarPlayers({ write: true });

    expect(spCreate).not.toHaveBeenCalled();
  });

  it("ne réécrit jamais displayName ni imageUrl d'une ligne existante", async () => {
    await syncStarPlayers({ write: true });

    const data = spUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("displayName");
    expect(data).not.toHaveProperty("imageUrl");
    expect(data).not.toHaveProperty("isMegaStar");
  });

  it("crée la ligne Skill manquante, réservée aux star players", async () => {
    const result = await syncStarPlayers({ write: true });

    expect(result.createdSkills).toEqual([
      expect.objectContaining({
        slug: "hate-dwarf",
        ruleset: "season_3",
        // Aucune Position du code ne porte `hate-dwarf` → non sélectionnable.
        excludedFromSelection: true,
      }),
    ]);
    expect(skillCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "hate-dwarf",
          excludedFromSelection: true,
        }),
      }),
    );
    // `block` existe déjà (et est porté par une Position) → pas recréé.
    expect(skillCreate).toHaveBeenCalledTimes(1);
  });

  it("idempotent : une fiche déjà conforme ne déclenche aucune écriture", async () => {
    const result = await syncStarPlayers({ write: true, slug: "mighty_zug" });

    expect(result.unchanged).toBe(1);
    expect(result.updated).toBe(0);
    expect(spUpdate).not.toHaveBeenCalled();
    expect(spsDeleteMany).not.toHaveBeenCalled();
    expect(hbDeleteMany).not.toHaveBeenCalled();
  });

  it("cible season_3 par défaut : la Saison 2 n'est jamais touchée", async () => {
    const result = await syncStarPlayers({ write: true });

    expect(result.players.every((p) => p.ruleset === "season_3")).toBe(true);
  });
});
