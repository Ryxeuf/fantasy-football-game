/**
 * Journaliers de la feuille de match — dérivation pure.
 *
 * Règle : une équipe qui aligne moins de 11 joueurs disponibles (morts,
 * absents missNextMatch exclus) engage un journalier par joueur manquant,
 * au poste lineman du roster (choix possible entre plusieurs linemen,
 * défaut = lineman de base), avec Solitaire (4+).
 */

import { describe, it, expect } from "vitest";
import {
  buildJourneymanHire,
  deriveJourneymen,
  deriveMatchJourneymen,
  isJourneymanId,
  linemanPositionsForRoster,
  parseFrozenSheetRoster,
  parseJourneymenChoice,
  JOURNEYMAN_ID_PREFIX,
  type SheetJourneyman,
} from "./league-sheet-journeymen";

function players(
  count: number,
  overrides: Array<Partial<{ dead: boolean; missNextMatch: boolean }>> = [],
) {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    dead: overrides[i]?.dead ?? false,
    missNextMatch: overrides[i]?.missNextMatch ?? false,
  }));
}

describe("isJourneymanId", () => {
  it("reconnait le préfixe synthétique", () => {
    expect(isJourneymanId(`${JOURNEYMAN_ID_PREFIX}home-1`)).toBe(true);
    expect(isJourneymanId("cku123abc")).toBe(false);
    expect(isJourneymanId(null)).toBe(false);
    expect(isJourneymanId(undefined)).toBe(false);
  });
});

describe("linemanPositionsForRoster", () => {
  it("retourne les postes 0-12+ (skaven : un seul lineman)", () => {
    const options = linemanPositionsForRoster("skaven", "season_3");
    expect(options.map((o) => o.slug)).toEqual(["skaven_rat_des_clans_skaven"]);
  });

  it("retourne plusieurs choix quand le roster a plusieurs linemen (undead)", () => {
    const options = linemanPositionsForRoster("undead", "season_3");
    expect(options.length).toBeGreaterThan(1);
    expect(options.map((o) => o.slug)).toContain("undead_trois_quart_squelette");
    expect(options.map((o) => o.slug)).toContain("undead_trois_quart_zombie");
  });

  it("roster inconnu -> aucune option", () => {
    expect(linemanPositionsForRoster("roster-inconnu")).toEqual([]);
  });
});

describe("deriveJourneymen", () => {
  it("aucun journalier quand 11 joueurs sont disponibles", () => {
    expect(
      deriveJourneymen({
        side: "home",
        roster: "skaven",
        ruleset: "season_3",
        players: players(11),
      }),
    ).toEqual([]);
  });

  it("un journalier par joueur manquant (morts + absents exclus)", () => {
    const out = deriveJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      // 11 joueurs mais 1 mort + 1 absent -> 9 disponibles -> 2 journaliers.
      players: players(11, [{ dead: true }, { missNextMatch: true }]),
    });
    expect(out).toHaveLength(2);
    expect(out.map((j) => j.id)).toEqual([
      "journeyman-home-1",
      "journeyman-home-2",
    ]);
    // Numeros a la suite du roster, noms lisibles.
    expect(out.map((j) => j.number)).toEqual([12, 13]);
    expect(out[0].name).toBe("Journalier 1");
    // Poste lineman du roster + Solitaire (4+).
    expect(out[0].position).toBe("skaven_rat_des_clans_skaven");
    expect(out[0].skills.split(",")).toContain("loner-4");
    expect(out[0].stats.ma).toBeGreaterThan(0);
  });

  it("respecte le choix du coach entre plusieurs linemen (undead)", () => {
    const out = deriveJourneymen({
      side: "away",
      roster: "undead",
      ruleset: "season_3",
      players: players(10),
      chosenPosition: "undead_trois_quart_zombie",
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("journeyman-away-1");
    expect(out[0].position).toBe("undead_trois_quart_zombie");
    expect(out[0].positionName).toContain("Journalier");
  });

  it("ignore un choix qui n'est pas un poste de lineman", () => {
    const out = deriveJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      players: players(10),
      chosenPosition: "skaven_blitzer", // pas un lineman
    });
    expect(out[0].position).toBe("skaven_rat_des_clans_skaven");
  });

  it("roster inconnu -> stats de repli (lineman humain)", () => {
    const out = deriveJourneymen({
      side: "home",
      roster: "roster-inconnu",
      players: players(10),
    });
    expect(out).toHaveLength(1);
    expect(out[0].stats).toEqual({ ma: 6, st: 3, ag: 3, pa: 4, av: 9 });
    expect(out[0].skills).toBe("loner-4");
    // Valeur de repli : lineman à 50k po.
    expect(out[0].cost).toBe(50_000);
  });

  it("porte la valeur du poste en po (règle BB : le journalier compte dans la CTV)", () => {
    const out = deriveJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      players: players(9),
    });
    expect(out).toHaveLength(2);
    // Rat des clans skaven : 50 kpo -> 50 000 po chacun.
    for (const j of out) {
      expect(j.cost).toBe(50_000);
    }
  });
});

describe("parseJourneymenChoice", () => {
  it("tolère objet natif (PG), string JSON (sqlite) et null", () => {
    expect(parseJourneymenChoice({ position: "x" })).toBe("x");
    expect(parseJourneymenChoice(JSON.stringify({ position: "y" }))).toBe("y");
    expect(parseJourneymenChoice(null)).toBeNull();
    expect(parseJourneymenChoice(undefined)).toBeNull();
    expect(parseJourneymenChoice("not-json")).toBeNull();
    expect(parseJourneymenChoice({ position: "" })).toBeNull();
  });
});

describe("buildJourneymanHire", () => {
  const journeyman: SheetJourneyman = {
    id: "journeyman-home-1",
    number: 12,
    name: "Journalier 1",
    position: "human_lineman",
    positionName: "Journalier (Trois-quarts)",
    stats: { ma: 6, st: 3, ag: 3, pa: 4, av: 9 },
    skills: "loner-4",
    cost: 50_000,
  };

  it("sans évolution : prix du poste, PSP du match conservés", () => {
    const hire = buildJourneymanHire({ journeyman, earnedSpp: 3 });
    expect(hire).toEqual({
      cost: 50_000,
      spp: 3,
      skills: "loner-4",
      advancements: "[]",
      stats: journeyman.stats,
    });
  });

  it("avec une compétence : prix renchéri du surcoût, PSP débités", () => {
    const hire = buildJourneymanHire({
      journeyman,
      earnedSpp: 6,
      advancement: {
        type: "primary",
        skillSlug: "block",
        pspCost: 6,
        valueSurcharge: 20_000,
      },
    });
    expect(hire.cost).toBe(70_000);
    expect(hire.spp).toBe(0);
    expect(hire.skills).toBe("loner-4,block");
    expect(JSON.parse(hire.advancements)).toEqual([
      { skillSlug: "block", type: "primary", isRandom: false, at: 0 },
    ]);
  });

  it("PSP insuffisants : l'évolution n'est pas prise (prix du poste)", () => {
    const hire = buildJourneymanHire({
      journeyman,
      earnedSpp: 3,
      advancement: {
        type: "primary",
        skillSlug: "block",
        pspCost: 6,
        valueSurcharge: 20_000,
      },
    });
    expect(hire.cost).toBe(50_000);
    expect(hire.spp).toBe(3);
    expect(hire.advancements).toBe("[]");
  });

  it("amélioration de caractéristique : stats finales + surcoût", () => {
    const hire = buildJourneymanHire({
      journeyman,
      earnedSpp: 14,
      advancement: {
        type: "characteristic",
        stat: "ag",
        d8: 5,
        pspCost: 14,
        valueSurcharge: 40_000,
      },
    });
    expect(hire.cost).toBe(90_000);
    // AG est une valeur cible : l'amélioration la fait BAISSER (3+ -> 2+).
    expect(hire.stats).toMatchObject({ ag: 2 });
    expect(hire.skills).toBe("loner-4");
  });
});

/**
 * Audit statique vs base — lot 3 (S4) : les postes viennent de `Position`
 * (base), injectés par la feuille de match. Le catalogue compilé n'est plus
 * que le repli. Un prix corrigé en admin doit changer la VEA du match et le
 * débit post-match ; un slug renommé ne doit plus rendre le journalier
 * « payé mais jamais matérialisé ».
 */
describe("postes injectés depuis la base", () => {
  const DB_POSITIONS = [
    {
      slug: "skaven_rat_des_clans_skaven",
      displayName: "Rat des Clans (corrigé)",
      // 50k au catalogue compilé, 65k en base.
      cost: 65,
      max: 16,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: "dodge",
    },
  ];

  it("prend le coût de la base plutôt que celui du catalogue", () => {
    const [j] = deriveJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      players: players(10),
      positions: DB_POSITIONS,
    });
    expect(j.cost).toBe(65_000);
    expect(j.stats).toMatchObject({ ma: 7, av: 8 });
    expect(j.positionName).toContain("Rat des Clans (corrigé)");
  });

  it("prend le slug de la base (un renommage suit le poste réel)", () => {
    const renamed = [{ ...DB_POSITIONS[0], slug: "skaven_lineman_v2" }];
    const [j] = deriveJourneymen({
      side: "away",
      roster: "skaven",
      ruleset: "season_3",
      players: players(10),
      positions: renamed,
    });
    expect(j.position).toBe("skaven_lineman_v2");
  });

  it("expose les options de lineman déclarées en base", () => {
    expect(
      linemanPositionsForRoster("skaven", "season_3", DB_POSITIONS).map(
        (o) => o.slug,
      ),
    ).toEqual(["skaven_rat_des_clans_skaven"]);
  });

  it("retombe sur le catalogue quand la base ne rend rien", () => {
    const [withDb] = deriveJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      players: players(10),
      positions: [],
    });
    const [without] = deriveJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      players: players(10),
    });
    expect(withDb).toEqual(without);
  });
});

/**
 * « Version du match » : les journaliers de la feuille sont ceux du COUP
 * D'ENVOI. Une fois la feuille validée, le roster live a bougé (morts et
 * blessures « rate le prochain match » appliquées par cette feuille) — le
 * relire ferait apparaître des journaliers qui n'ont jamais joué ce match.
 */
describe("journaliers de la version figée du match", () => {
  /** Snapshot d'un côté : joueurs réels + journaliers bakés au gel. */
  function snapshot(realCount: number, journeymenNumbers: number[] = []) {
    return {
      teamValue: 1_000_000,
      currentValue: 1_000_000,
      players: [
        ...Array.from({ length: realCount }, (_, i) => ({
          name: `Joueur ${i + 1}`,
          position: "skaven_rat_des_clans_skaven",
          number: i + 1,
          spp: 0,
        })),
        ...journeymenNumbers.map((number, i) => ({
          name: `Journalier ${i + 1}`,
          position: "Journalier (Rat des Clans Skaven)",
          number,
          spp: 0,
        })),
      ],
    };
  }

  it("compte les journaliers du GEL, pas ceux du roster d'aujourd'hui", () => {
    // Au coup d'envoi : 10 joueurs disponibles ⇒ 1 journalier. Depuis, la
    // feuille a tué un joueur et blessé deux autres : le roster live n'en
    // aligne plus que 7 (⇒ 4 journaliers pour le PROCHAIN match).
    const live = players(10, [
      { dead: true },
      { missNextMatch: true },
      { missNextMatch: true },
    ]);
    const derived = deriveMatchJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      players: live,
      frozenRosterSnapshot: snapshot(10, [11]),
    });
    expect(derived).toHaveLength(1);
    expect(derived[0]!.number).toBe(11);
    expect(derived[0]!.name).toBe("Journalier 1");
    // Sans le gel, la dérivation live en compterait 4.
    expect(
      deriveJourneymen({
        side: "home",
        roster: "skaven",
        ruleset: "season_3",
        players: live,
      }),
    ).toHaveLength(4);
  });

  it("ne rend AUCUN journalier quand le match s'est joué à 11", () => {
    const live = players(11, [{ dead: true }]);
    expect(
      deriveMatchJourneymen({
        side: "away",
        roster: "skaven",
        ruleset: "season_3",
        players: live,
        frozenRosterSnapshot: snapshot(11),
      }),
    ).toEqual([]);
  });

  it("accepte le snapshot sérialisé (miroir sqlite)", () => {
    const derived = deriveMatchJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      players: players(11),
      frozenRosterSnapshot: JSON.stringify(snapshot(9, [10, 11])),
    });
    expect(derived.map((j) => j.number)).toEqual([10, 11]);
    expect(derived.map((j) => j.id)).toEqual([
      "journeyman-home-1",
      "journeyman-home-2",
    ]);
  });

  it("retombe sur le roster live sans gel exploitable", () => {
    const live = players(9);
    for (const raw of [
      undefined,
      null,
      "pas du json",
      { headerOnly: true, teamValue: 1 },
      { teamValue: 1 },
    ]) {
      expect(parseFrozenSheetRoster(raw)).toBeNull();
      expect(
        deriveMatchJourneymen({
          side: "home",
          roster: "skaven",
          ruleset: "season_3",
          players: live,
          frozenRosterSnapshot: raw,
        }),
      ).toHaveLength(2);
    }
  });

  it("sépare joueurs réels et journaliers bakés du snapshot", () => {
    const frozen = parseFrozenSheetRoster(snapshot(10, [11]));
    expect(frozen?.players).toHaveLength(10);
    // Le gel exclut déjà morts, licenciés et absents : tous disponibles.
    expect(frozen?.players.every((p) => !p.dead && !p.missNextMatch)).toBe(true);
    expect(frozen?.journeymen).toEqual([{ number: 11, name: "Journalier 1" }]);
  });
});
