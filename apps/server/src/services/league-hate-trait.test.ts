/**
 * Haine (X) — acquisition du trait sur blessure.
 *
 * Couvre la selection des candidats (pure), le jet + la pose du trait
 * (creation de la competence a la volee incluse) et la reversion.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Journal d'equipe : service dedie (teste dans team-audit.test.ts). Ici on
// verifie seulement qu'une acquisition/reversion y laisse une trace.
vi.mock("./team-audit", () => ({
  safeRecordTeamAudit: vi.fn(async () => {}),
}));

vi.mock("../prisma", () => ({
  prisma: {
    position: { findMany: vi.fn() },
    skill: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    teamPlayer: { findMany: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import { safeRecordTeamAudit } from "./team-audit";
import {
  HATE_TRIGGERING_INJURIES,
  applyHateTraitAcquisitions,
  buildHateCandidates,
  buildSheetKeywordMap,
  parseHateGrants,
  resolveKeywordsByPosition,
  revertHateTraitGrants,
  starKeywordsFromSheetId,
} from "./league-hate-trait";

type MockFn = ReturnType<typeof vi.fn>;
const m = {
  positionFindMany: prisma.position.findMany as unknown as MockFn,
  skillFindUnique: prisma.skill.findUnique as unknown as MockFn,
  skillCreate: prisma.skill.create as unknown as MockFn,
  tpFindMany: prisma.teamPlayer.findMany as unknown as MockFn,
  tpUpdate: prisma.teamPlayer.update as unknown as MockFn,
  audit: safeRecordTeamAudit as unknown as MockFn,
};

describe("HATE_TRIGGERING_INJURIES", () => {
  it("couvre les blessures qui coutent au moins le match suivant", () => {
    for (const type of ["mng", "niggling", "ma", "st", "ag", "pa", "av"]) {
      expect(HATE_TRIGGERING_INJURIES.has(type as never)).toBe(true);
    }
  });

  it("exclut la mort : un mort n'a plus personne a hair", () => {
    expect(HATE_TRIGGERING_INJURIES.has("dead" as never)).toBe(false);
  });
});

describe("buildHateCandidates", () => {
  const keywords = new Map([
    ["orc-1", "Orque, Blitzer"],
    ["poste-only", "Blitzer, Coureur"],
  ]);

  it("retient la lignee de l'auteur de la sortie", () => {
    expect(
      buildHateCandidates({
        injuries: [
          { victimPlayerId: "v1", causerPlayerId: "orc-1", injuryType: "mng" },
        ],
        keywordsByPlayerId: keywords,
      }),
    ).toEqual([{ victimPlayerId: "v1", keyword: "Orque" }]);
  });

  it("ignore une blessure qui ne coute pas le match suivant", () => {
    expect(
      buildHateCandidates({
        injuries: [
          { victimPlayerId: "v1", causerPlayerId: "orc-1", injuryType: "dead" },
        ],
        keywordsByPlayerId: keywords,
      }),
    ).toEqual([]);
  });

  it("ignore une sortie sans auteur (auto-elimination, foule)", () => {
    expect(
      buildHateCandidates({
        injuries: [
          { victimPlayerId: "v1", causerPlayerId: null, injuryType: "mng" },
        ],
        keywordsByPlayerId: keywords,
      }),
    ).toEqual([]);
  });

  it("ignore un auteur n'ayant que des mots-cles de poste", () => {
    expect(
      buildHateCandidates({
        injuries: [
          {
            victimPlayerId: "v1",
            causerPlayerId: "poste-only",
            injuryType: "niggling",
          },
        ],
        keywordsByPlayerId: keywords,
      }),
    ).toEqual([]);
  });

  it("ignore un auteur dont on ignore les mots-cles", () => {
    expect(
      buildHateCandidates({
        injuries: [
          { victimPlayerId: "v1", causerPlayerId: "inconnu", injuryType: "av" },
        ],
        keywordsByPlayerId: keywords,
      }),
    ).toEqual([]);
  });

  it("ne fait jeter qu'une fois par couple (victime, mot-cle)", () => {
    expect(
      buildHateCandidates({
        injuries: [
          { victimPlayerId: "v1", causerPlayerId: "orc-1", injuryType: "mng" },
          { victimPlayerId: "v1", causerPlayerId: "orc-1", injuryType: "st" },
        ],
        keywordsByPlayerId: keywords,
      }),
    ).toEqual([{ victimPlayerId: "v1", keyword: "Orque" }]);
  });
});

describe("starKeywordsFromSheetId", () => {
  it("lit les mots-cles d'un Star Player engage", () => {
    // Griff Oberwald : Star Player humain du catalogue.
    expect(starKeywordsFromSheetId("star-home-griff_oberwald")).toContain(
      "Humain",
    );
  });

  it("retourne null hors du format synthetique", () => {
    expect(starKeywordsFromSheetId("cuid-normal")).toBeNull();
  });
});

describe("resolveKeywordsByPosition", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("prend la base d'abord, le moteur en repli", async () => {
    m.positionFindMany.mockResolvedValue([
      { slug: "human_blitzer", keywords: "Humain, Champion" },
    ]);
    const out = await resolveKeywordsByPosition([
      "human_blitzer",
      "orc_blitzer_orque",
    ]);
    // Colonne editee en admin -> prioritaire.
    expect(out.get("human_blitzer")).toBe("Humain, Champion");
    // Absente en base -> transcription du moteur.
    expect(out.get("orc_blitzer_orque")).toBe("Orque, Blitzer");
  });

  it("retombe sur le moteur quand la base est indisponible", async () => {
    m.positionFindMany.mockRejectedValue(new Error("db down"));
    const out = await resolveKeywordsByPosition(["orc_blitzer_orque"]);
    expect(out.get("orc_blitzer_orque")).toBe("Orque, Blitzer");
  });

  it("ignore une colonne vide", async () => {
    m.positionFindMany.mockResolvedValue([
      { slug: "orc_blitzer_orque", keywords: "   " },
    ]);
    const out = await resolveKeywordsByPosition(["orc_blitzer_orque"]);
    expect(out.get("orc_blitzer_orque")).toBe("Orque, Blitzer");
  });
});

describe("buildSheetKeywordMap", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.positionFindMany.mockResolvedValue([]);
  });

  it("couvre roster, journaliers et Star Players", async () => {
    const out = await buildSheetKeywordMap({
      positionedPlayers: [
        { id: "p1", position: "orc_blitzer_orque" },
        { id: "journeyman-home-1", position: "human_trois_quart" },
      ],
      starPlayerIds: ["star-away-griff_oberwald"],
    });
    expect(out.get("p1")).toBe("Orque, Blitzer");
    expect(out.get("journeyman-home-1")).toBe("Humain, Trois-quart");
    expect(out.get("star-away-griff_oberwald")).toContain("Humain");
  });

  it("laisse hors map un poste sans mots-cles connus", async () => {
    const out = await buildSheetKeywordMap({
      positionedPlayers: [{ id: "p1", position: "poste_inconnu" }],
    });
    expect(out.has("p1")).toBe(false);
  });
});

describe("applyHateTraitAcquisitions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.tpUpdate.mockResolvedValue({});
    m.skillCreate.mockResolvedValue({ id: "sk1" });
  });

  const victim = (over: Record<string, unknown> = {}) => ({
    id: "v1",
    teamId: "t1",
    skills: "block",
    dead: false,
    team: { ruleset: "season_3" },
    ...over,
  });

  it("accorde le trait sur 4+ et le pose sur la CSV de competences", async () => {
    m.tpFindMany.mockResolvedValue([victim()]);
    m.skillFindUnique.mockResolvedValue({ id: "sk-existing" });

    const out = await applyHateTraitAcquisitions({
      candidates: [{ victimPlayerId: "v1", keyword: "Orque" }],
      allowedTeamIds: ["t1"],
      roll: () => 4,
    });

    expect(out.granted).toEqual([
      { playerId: "v1", skillSlug: "hate-orque", keyword: "Orque", roll: 4 },
    ]);
    expect(m.tpUpdate).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { skills: "block,hate-orque" },
    });
  });

  it("n'accorde rien sur 3-", async () => {
    m.tpFindMany.mockResolvedValue([victim()]);
    m.skillFindUnique.mockResolvedValue({ id: "sk-existing" });

    const out = await applyHateTraitAcquisitions({
      candidates: [{ victimPlayerId: "v1", keyword: "Orque" }],
      allowedTeamIds: ["t1"],
      roll: () => 3,
    });

    expect(out.granted).toEqual([]);
    expect(m.tpUpdate).not.toHaveBeenCalled();
  });

  it("cree le trait au catalogue quand il n'existe pas encore", async () => {
    m.tpFindMany.mockResolvedValue([victim()]);
    m.skillFindUnique.mockResolvedValue(null);

    await applyHateTraitAcquisitions({
      candidates: [{ victimPlayerId: "v1", keyword: "Homme Lézard" }],
      allowedTeamIds: ["t1"],
      roll: () => 6,
    });

    const created = m.skillCreate.mock.calls[0][0].data;
    expect(created).toMatchObject({
      slug: "hate-homme-lezard",
      nameFr: "Haine (Homme Lézard)",
      category: "Trait",
      ruleset: "season_3",
      // Le trait ne s'obtient qu'en etant blesse : jamais selectionnable.
      excludedFromSelection: true,
    });
  });

  it("repare une ligne anterieure restee selectionnable", async () => {
    m.tpFindMany.mockResolvedValue([victim()]);
    m.skillFindUnique.mockResolvedValue({
      id: "sk-troll",
      excludedFromSelection: false,
    });
    (prisma.skill as unknown as { update: MockFn }).update.mockResolvedValue({});

    await applyHateTraitAcquisitions({
      candidates: [{ victimPlayerId: "v1", keyword: "Troll" }],
      allowedTeamIds: ["t1"],
      roll: () => 6,
    });

    expect(
      (prisma.skill as unknown as { update: MockFn }).update.mock.calls[0][0],
    ).toMatchObject({ data: { excludedFromSelection: true } });
  });

  it("reutilise la variante deja au catalogue (Troll)", async () => {
    m.tpFindMany.mockResolvedValue([victim()]);
    m.skillFindUnique.mockResolvedValue({
      id: "sk-troll",
      excludedFromSelection: true,
    });

    const out = await applyHateTraitAcquisitions({
      candidates: [{ victimPlayerId: "v1", keyword: "Troll" }],
      allowedTeamIds: ["t1"],
      roll: () => 5,
    });

    expect(out.granted[0].skillSlug).toBe("hate-troll");
    expect(m.skillCreate).not.toHaveBeenCalled();
  });

  it("ne rejette pas pour un mot-cle deja hai", async () => {
    m.tpFindMany.mockResolvedValue([victim({ skills: "block,hate-orque" })]);
    const roll = vi.fn(() => 6);

    const out = await applyHateTraitAcquisitions({
      candidates: [{ victimPlayerId: "v1", keyword: "Orque" }],
      allowedTeamIds: ["t1"],
      roll,
    });

    expect(out.granted).toEqual([]);
    expect(roll).not.toHaveBeenCalled();
  });

  it("ignore un joueur mort entre-temps", async () => {
    m.tpFindMany.mockResolvedValue([victim({ dead: true })]);
    const out = await applyHateTraitAcquisitions({
      candidates: [{ victimPlayerId: "v1", keyword: "Orque" }],
      allowedTeamIds: ["t1"],
      roll: () => 6,
    });
    expect(out.granted).toEqual([]);
  });

  it("ignore un joueur hors des 2 equipes du match", async () => {
    m.tpFindMany.mockResolvedValue([]);
    const out = await applyHateTraitAcquisitions({
      candidates: [{ victimPlayerId: "etranger", keyword: "Orque" }],
      allowedTeamIds: ["t1"],
      roll: () => 6,
    });
    expect(out.granted).toEqual([]);
    expect(m.tpUpdate).not.toHaveBeenCalled();
  });

  it("n'accorde rien si la creation du trait echoue (pas de slug orphelin)", async () => {
    m.tpFindMany.mockResolvedValue([victim()]);
    m.skillFindUnique.mockResolvedValue(null);
    m.skillCreate.mockRejectedValue(new Error("db down"));

    const out = await applyHateTraitAcquisitions({
      candidates: [{ victimPlayerId: "v1", keyword: "Orque" }],
      allowedTeamIds: ["t1"],
      roll: () => 6,
    });

    expect(out.granted).toEqual([]);
    expect(m.tpUpdate).not.toHaveBeenCalled();
  });

  it("cumule deux mots-cles distincts sur le meme joueur", async () => {
    m.tpFindMany.mockResolvedValue([victim({ skills: "" })]);
    m.skillFindUnique.mockResolvedValue({ id: "sk" });

    const out = await applyHateTraitAcquisitions({
      candidates: [
        { victimPlayerId: "v1", keyword: "Orque" },
        { victimPlayerId: "v1", keyword: "Gobelin" },
      ],
      allowedTeamIds: ["t1"],
      roll: () => 6,
    });

    expect(out.granted.map((g) => g.skillSlug)).toEqual([
      "hate-orque",
      "hate-gobelin",
    ]);
    // La 2e pose part de la CSV deja augmentee par la 1re.
    expect(m.tpUpdate.mock.calls[1][0].data).toEqual({
      skills: "hate-orque,hate-gobelin",
    });
  });
});

describe("revertHateTraitGrants", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.tpUpdate.mockResolvedValue({});
  });

  it("retire le trait accorde par le match invalide", async () => {
    m.tpFindMany.mockResolvedValue([
      { id: "v1", teamId: "t1", skills: "block,hate-orque,dodge" },
    ]);

    const removed = await revertHateTraitGrants([
      { playerId: "v1", skillSlug: "hate-orque", keyword: "Orque", roll: 5 },
    ]);

    expect(removed).toBe(1);
    expect(m.tpUpdate).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { skills: "block,dodge" },
    });
  });

  it("ne touche pas un trait deja retire", async () => {
    m.tpFindMany.mockResolvedValue([{ id: "v1", teamId: "t1", skills: "block" }]);
    const removed = await revertHateTraitGrants([
      { playerId: "v1", skillSlug: "hate-orque", keyword: "Orque", roll: 5 },
    ]);
    expect(removed).toBe(0);
    expect(m.tpUpdate).not.toHaveBeenCalled();
  });

  it("ne lit rien sans grant", async () => {
    expect(await revertHateTraitGrants([])).toBe(0);
    expect(m.tpFindMany).not.toHaveBeenCalled();
  });
});

describe("parseHateGrants", () => {
  it("accepte l'array natif (PG) et la chaine serialisee (sqlite)", () => {
    const grants = [
      { playerId: "v1", skillSlug: "hate-orque", keyword: "Orque", roll: 5 },
    ];
    expect(parseHateGrants(grants)).toEqual(grants);
    expect(parseHateGrants(JSON.stringify(grants))).toEqual(grants);
  });

  it("tolere null, JSON casse et entrees incompletes", () => {
    expect(parseHateGrants(null)).toEqual([]);
    expect(parseHateGrants("{pas du json")).toEqual([]);
    expect(parseHateGrants([{ playerId: "v1" }, null, 3])).toEqual([]);
  });
});

describe("journal d'equipe", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.tpUpdate.mockResolvedValue({});
    m.skillFindUnique.mockResolvedValue({ id: "sk", excludedFromSelection: true });
  });

  it("trace l'acquisition (qui, quoi, quel jet)", async () => {
    m.tpFindMany.mockResolvedValue([
      {
        id: "v1",
        teamId: "t1",
        skills: "block",
        dead: false,
        team: { ruleset: "season_3" },
      },
    ]);

    await applyHateTraitAcquisitions({
      candidates: [{ victimPlayerId: "v1", keyword: "Orque" }],
      allowedTeamIds: ["t1"],
      roll: () => 5,
    });

    expect(m.audit.mock.calls[0][1]).toMatchObject({
      teamId: "t1",
      action: "team.player.hate_trait",
      entity: "TeamPlayer",
      entityId: "v1",
      details: { skillSlug: "hate-orque", keyword: "Orque", roll: 5 },
    });
  });

  it("trace la reversion", async () => {
    m.tpFindMany.mockResolvedValue([
      { id: "v1", teamId: "t1", skills: "block,hate-orque" },
    ]);

    await revertHateTraitGrants([
      { playerId: "v1", skillSlug: "hate-orque", keyword: "Orque", roll: 5 },
    ]);

    expect(m.audit.mock.calls[0][1]).toMatchObject({
      teamId: "t1",
      action: "team.player.hate_trait.reverted",
      entityId: "v1",
    });
  });
});
