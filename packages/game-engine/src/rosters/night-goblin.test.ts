import { describe, it, expect } from "vitest";
import { SEASON_THREE_ROSTERS } from "./season3-rosters";
import { TEAM_ROSTERS_BY_RULESET } from "./positions";
import { SKILL_ACCESS_SEASON3 } from "./skill-access-season3";
import { KEYWORDS_SEASON3 } from "./keywords-season3";
import { getPositionNameEn } from "./position-names-en";
import { translateKeywordsCsv } from "./keyword-translations";
import { getRerollCost } from "./reroll-costs";
import { canRosterHaveApothecary } from "./apothecary-access";
import { getRegionalRulesForTeam } from "./star-players";
import { getSpecialRulesForTeam } from "./team-special-rules";
import { getRosterName } from "./roster-names";
import { getSkillBySlug } from "../skills/index";

/**
 * Gobelins de la Nuit — transcription de la fiche d'équipe Saison 3
 * (photo du livre, 2026-11-19). Chaque ligne du tableau est verrouillée :
 * quantité, coût, profil, compétences, accès primaire/secondaire (notation
 * anglaise A/D/G/P/S convertie : D « Devious » → K, S « Strength » → S).
 */
interface SheetRow {
  slug: string;
  nameEn: string;
  max: number;
  cost: number;
  profile: [number, number, number, number, number]; // MA ST AG PA AV (PA 0 = « - »)
  skills: string[];
  keywords: string;
  primary: string;
  secondary: string;
}

const SHEET: SheetRow[] = [
  {
    slug: "night_goblin_trois_quart_gobelin_de_la_nuit",
    nameEn: "Night Goblin Lineman",
    max: 16,
    cost: 45,
    profile: [6, 2, 3, 4, 8],
    skills: ["dodge", "right-stuff", "shadowing", "stunty", "provocation"],
    keywords: "Goblin, Lineman",
    primary: "A,K",
    secondary: "G,S,P",
  },
  {
    slug: "night_goblin_gardien_de_squigs",
    nameEn: "Squig Herder",
    max: 2,
    cost: 55,
    profile: [6, 2, 3, 5, 8],
    skills: ["dodge", "disturbing-presence", "fend", "squig-restraint", "stunty"],
    keywords: "Goblin, Special",
    primary: "A,K",
    secondary: "G,S,P",
  },
  {
    slug: "night_goblin_chevaucheur_de_squig",
    nameEn: "Squig Hopper",
    max: 2,
    cost: 80,
    profile: [7, 3, 3, 4, 8],
    skills: ["dodge", "jump-up", "monstrous-mouth", "pogo-stick", "squig-rage"],
    keywords: "Goblin, Special, Squig",
    primary: "A,K",
    secondary: "G,S,P",
  },
  {
    slug: "night_goblin_dompteur_de_squig",
    nameEn: "Squig Wrangler",
    max: 2,
    cost: 70,
    profile: [3, 7, 3, 0, 8],
    skills: ["ball-and-chain", "no-hands", "squig-rage", "stunty"],
    keywords: "Goblin, Special, Squig",
    primary: "S,K",
    secondary: "G,A",
  },
  {
    slug: "night_goblin_squig_des_cavernes",
    nameEn: "Cave Squig",
    max: 2,
    cost: 85,
    profile: [6, 4, 3, 0, 9],
    skills: ["frenzy", "jump-up", "monstrous-mouth", "no-hands", "pogo-stick", "squig-rage"],
    keywords: "Squig, Special",
    primary: "",
    secondary: "G,A,S,K",
  },
  {
    slug: "night_goblin_troll_entraine",
    nameEn: "Trained Troll",
    max: 1,
    cost: 115,
    profile: [4, 5, 5, 5, 10],
    skills: [
      "always-hungry",
      "mighty-blow-1",
      "projectile-vomit",
      "really-stupid",
      "regeneration",
      "throw-team-mate",
    ],
    keywords: "Troll, Big Guy",
    primary: "S",
    secondary: "G,A,P",
  },
];

describe("Gobelins de la Nuit (night_goblin) — fiche Saison 3", () => {
  const roster = SEASON_THREE_ROSTERS.night_goblin;

  it("existe en Saison 3 uniquement, avec ses libellés FR", () => {
    expect(roster).toBeTruthy();
    expect(roster.name).toBe("Gobelins de la Nuit");
    expect(getRosterName("night_goblin")).toBe("Gobelins de la Nuit");
    expect(TEAM_ROSTERS_BY_RULESET.season_2.night_goblin).toBeUndefined();
    expect(roster.descriptionFr).toBeTruthy();
    expect(roster.descriptionEn).toBeTruthy();
  });

  it("porte la Ligue, la règle spéciale, la relance et l'apothicaire de la fiche", () => {
    expect(roster.regionalRules).toEqual(["underworld_challenge"]);
    expect(getRegionalRulesForTeam("night_goblin", "season_3")).toEqual([
      "underworld_challenge",
    ]);
    expect(getSpecialRulesForTeam("night_goblin", "season_3")).toEqual([
      "chantage_et_corruption",
    ]);
    expect(getRerollCost("night_goblin")).toBe(70_000);
    expect(canRosterHaveApothecary("night_goblin")).toBe(true);
  });

  it("liste exactement les six postes de la fiche, dans l'ordre", () => {
    expect(roster.positions.map((p) => p.slug)).toEqual(SHEET.map((r) => r.slug));
  });

  for (const row of SHEET) {
    it(`${row.nameEn} : quantité, coût, profil, compétences, accès, mots-clés`, () => {
      const pos = roster.positions.find((p) => p.slug === row.slug);
      expect(pos).toBeTruthy();
      if (!pos) return;
      expect([pos.min, pos.max]).toEqual([0, row.max]);
      expect(pos.cost).toBe(row.cost);
      expect([pos.ma, pos.st, pos.ag, pos.pa, pos.av]).toEqual(row.profile);
      expect(pos.skills.split(",").sort()).toEqual([...row.skills].sort());
      expect(getPositionNameEn(row.slug)).toBe(row.nameEn);
      expect(SKILL_ACCESS_SEASON3[row.slug]).toEqual({
        primary: row.primary,
        secondary: row.secondary,
      });
      expect(translateKeywordsCsv(KEYWORDS_SEASON3[row.slug], "en")).toBe(
        row.keywords,
      );
    });
  }

  it("un seul poste fournit les journaliers : le Trois-quart 0-16", () => {
    const linemen = roster.positions.filter(
      (p) => p.max === 16 && /Trois-quart/.test(KEYWORDS_SEASON3[p.slug] ?? ""),
    );
    expect(linemen.map((p) => p.slug)).toEqual([
      "night_goblin_trois_quart_gobelin_de_la_nuit",
    ]);
  });

  it("chaque compétence de la fiche existe au catalogue", () => {
    for (const row of SHEET) {
      for (const slug of row.skills) {
        expect(getSkillBySlug(slug), slug).toBeTruthy();
      }
    }
  });

  it("déclare les deux nouveaux Traits, traduits, passifs et réservés à la Saison 3", () => {
    const rage = getSkillBySlug("squig-rage");
    const restraint = getSkillBySlug("squig-restraint");
    expect(rage).toMatchObject({
      nameFr: "Rage de Squig",
      nameEn: "Squig Rage",
      category: "Trait",
      isPassive: true,
      season3Only: true,
    });
    expect(restraint).toMatchObject({
      nameFr: "Maîtrise de Squig",
      nameEn: "Squig Restraint",
      category: "Trait",
      isPassive: true,
      season3Only: true,
    });
    for (const skill of [rage, restraint]) {
      expect(skill?.description.length).toBeGreaterThan(40);
      expect(skill?.descriptionEn?.length).toBeGreaterThan(40);
    }
    // Les seuils de la règle (3+ normal, 1-2 enragé ; portée de 3 cases).
    expect(rage?.description).toMatch(/3\+/);
    expect(rage?.description).toMatch(/1-2/);
    expect(restraint?.description).toMatch(/3 cases/);
  });
});
