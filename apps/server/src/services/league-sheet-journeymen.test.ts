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
  journeymanRandomPrimarySeed,
  journeymanSide,
  journeymanSkillAccess,
  linemanPositionsForRoster,
  splitSkillCsv,
  parseFrozenSheetRoster,
  parseJourneymenChoice,
  parseJourneymenChoices,
  journeymenChoiceInput,
  rebakeFrozenJourneymen,
  sumJourneymenValue,
  toFrozenJourneymanEntry,
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

describe("journeymanSide", () => {
  it("lit le côté dans l'id synthétique", () => {
    expect(journeymanSide("journeyman-home-1")).toBe("home");
    expect(journeymanSide("journeyman-away-3")).toBe("away");
  });

  it("null pour un id réel, un côté inconnu ou une valeur absente", () => {
    expect(journeymanSide("cku123abc")).toBeNull();
    expect(journeymanSide("journeyman-north-1")).toBeNull();
    expect(journeymanSide(null)).toBeNull();
    expect(journeymanSide(undefined)).toBeNull();
  });
});

describe("splitSkillCsv", () => {
  it("découpe, trim et ignore les entrées vides", () => {
    expect(splitSkillCsv(" block , dodge,,loner-4 ")).toEqual([
      "block",
      "dodge",
      "loner-4",
    ]);
    expect(splitSkillCsv("")).toEqual([]);
    expect(splitSkillCsv(null)).toEqual([]);
  });
});

describe("journeymanSkillAccess", () => {
  it("lit l'accès en base quand la ligne le renseigne", () => {
    expect(
      journeymanSkillAccess("orc_trois_quart_gobelin", [
        {
          slug: "orc_trois_quart_gobelin",
          displayName: "Trois-quart Gobelin",
          cost: 40,
          max: 4,
          ma: 6,
          st: 2,
          ag: 3,
          pa: 4,
          av: 8,
          skills: "stunty,right-stuff,dodge",
          primarySkills: "A",
          secondarySkills: "G,K",
        },
      ]),
    ).toEqual({ primary: "A", secondary: "G,K" });
  });

  it("retombe sur la table compilée quand la base ne dit rien", () => {
    // Ligne en base SANS accès (null/null) : c'est le catalogue qui parle.
    expect(
      journeymanSkillAccess("orc_trois_quart_gobelin", [
        {
          slug: "orc_trois_quart_gobelin",
          displayName: "Trois-quart Gobelin",
          cost: 40,
          max: 4,
          ma: 6,
          st: 2,
          ag: 3,
          pa: 4,
          av: 8,
          skills: "",
          primarySkills: null,
          secondarySkills: null,
        },
      ]),
    ).toEqual({ primary: "A,K", secondary: "G,P,K" });
    expect(journeymanSkillAccess("orc_trois_quart_orque", null)).toEqual({
      primary: "G,S",
      secondary: "A,K",
    });
  });

  it("poste inconnu : accès non renseigné", () => {
    expect(journeymanSkillAccess("poste-inconnu", [])).toEqual({
      primary: null,
      secondary: null,
    });
  });
});

describe("journeymanRandomPrimarySeed", () => {
  const j = { id: "journeyman-home-1", position: "orc_trois_quart_orque" };

  it("est stable pour la même feuille, le même journalier et la même catégorie", () => {
    expect(journeymanRandomPrimarySeed("ms1", j, "G")).toBe(
      journeymanRandomPrimarySeed("ms1", j, "G"),
    );
  });

  it("change avec la feuille, le journalier, le poste ou la catégorie", () => {
    const base = journeymanRandomPrimarySeed("ms1", j, "G");
    expect(journeymanRandomPrimarySeed("ms2", j, "G")).not.toBe(base);
    expect(
      journeymanRandomPrimarySeed("ms1", { ...j, id: "journeyman-home-2" }, "G"),
    ).not.toBe(base);
    expect(
      journeymanRandomPrimarySeed(
        "ms1",
        { ...j, position: "orc_trois_quart_gobelin" },
        "G",
      ),
    ).not.toBe(base);
    expect(journeymanRandomPrimarySeed("ms1", j, "S")).not.toBe(base);
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
    expect(options.map((o) => o.slug)).toContain(
      "undead_trois_quart_squelette",
    );
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
      advancementTaken: false,
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
    expect(hire.advancementTaken).toBe(true);
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
    expect(hire.advancementTaken).toBe(false);
    expect(hire.cost).toBe(50_000);
    expect(hire.spp).toBe(3);
    expect(hire.advancements).toBe("[]");
  });

  it("amélioration de caractéristique : bornée aux limites BB2025 (ST ≤ 5)", () => {
    const hire = buildJourneymanHire({
      journeyman: { ...journeyman, stats: { ...journeyman.stats, st: 5 } },
      earnedSpp: 14,
      advancement: {
        type: "characteristic",
        stat: "st",
        d8: 8,
        pspCost: 14,
        valueSurcharge: 80_000,
      },
    });
    expect(hire.stats.st).toBe(5);
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
    expect(frozen?.players.every((p) => !p.dead && !p.missNextMatch)).toBe(
      true,
    );
    expect(frozen?.journeymen).toEqual([{ number: 11, name: "Journalier 1" }]);
  });
});

// ───────────────────────────── E37 — CHOIX PAR JOURNALIER ─────────────────

describe("rebakeFrozenJourneymen (changement de poste d'avant-match)", () => {
  const orc = (id: string, number: number): SheetJourneyman => ({
    id,
    number,
    name: `Journalier ${number - 11}`,
    position: "orc_trois_quart_orque",
    positionName: "Journalier (Trois-quart Orque)",
    stats: { ma: 5, st: 3, ag: 3, pa: 4, av: 10 },
    skills: "loner-4",
    cost: 50_000,
  });
  const goblin = (id: string, number: number): SheetJourneyman => ({
    ...orc(id, number),
    position: "orc_trois_quart_gobelin",
    positionName: "Journalier (Trois-quart Gobelin)",
    stats: { ma: 6, st: 2, ag: 3, pa: 4, av: 8 },
    skills: "stunty,right-stuff,dodge,loner-4",
    cost: 40_000,
  });
  const orcs = [orc("journeyman-home-1", 12), orc("journeyman-home-2", 13)];
  /** Gel d'un roster à 9 + 2 Trois-quarts Orques : VEA 840k + 2 × 50k. */
  const frozen = (extra: Record<string, unknown> = {}) => ({
    capturedAt: 1,
    roster: "orc",
    currentValue: 940_000,
    treasury: 30_000,
    players: [
      { name: "J1", position: "orc_blitzer", number: 1, spp: 0 },
      ...orcs.map(toFrozenJourneymanEntry),
    ],
    ...extra,
  });

  it("remplace les journaliers bakés et ajuste la VEA figée (ancienne valeur re-dérivée sans journeymenValue)", () => {
    const out = rebakeFrozenJourneymen({
      raw: JSON.stringify(frozen()),
      previous: orcs,
      next: [goblin("journeyman-home-1", 12), orc("journeyman-home-2", 13)],
    });
    const snap = JSON.parse(out as string);
    // 940k − 50k (Orque) + 40k (Gobelin).
    expect(snap.currentValue).toBe(930_000);
    expect(snap.journeymenValue).toBe(90_000);
    expect(snap.players).toHaveLength(3);
    expect(snap.players[0]).toMatchObject({ name: "J1", position: "orc_blitzer" });
    expect(snap.players[1]).toMatchObject({
      number: 12,
      name: "Journalier 1",
      position: "Journalier (Trois-quart Gobelin)",
      ma: 6,
      st: 2,
      av: 8,
      skills: "stunty,right-stuff,dodge,loner-4",
    });
    expect(snap.players[2]).toMatchObject({
      number: 13,
      position: "Journalier (Trois-quart Orque)",
    });
    // Le reste de l'en-tête figé est préservé.
    expect(snap).toMatchObject({ capturedAt: 1, roster: "orc", treasury: 30_000 });
  });

  it("retire la valeur STOCKÉE quand le snapshot la porte (objet natif PG)", () => {
    // 120k stockés (prix corrigés en admin depuis le gel) : c'est cette
    // valeur qui sort, pas les 100k re-dérivés de l'ancien choix.
    const out = rebakeFrozenJourneymen({
      raw: frozen({ currentValue: 960_000, journeymenValue: 120_000 }),
      previous: orcs,
      next: [goblin("journeyman-home-1", 12), goblin("journeyman-home-2", 13)],
    });
    expect(JSON.parse(out as string).currentValue).toBe(920_000);
  });

  it("snapshot antérieur au re-gel : la valeur retirée est celle des journaliers BAKÉS, pas du choix stocké", () => {
    // Le poste avait été changé (choix stocké = 2 Gobelins) AVANT que le
    // re-gel existe : le gel porte toujours 2 Trois-quarts Orques (2 × 50k
    // dans la VEA figée), pas les 2 × 40k que re-dérive le choix stocké.
    const previousFromStoredChoice = [
      goblin("journeyman-home-1", 12),
      goblin("journeyman-home-2", 13),
    ];
    const out = rebakeFrozenJourneymen({
      raw: frozen(),
      previous: previousFromStoredChoice,
      next: [goblin("journeyman-home-1", 12), orc("journeyman-home-2", 13)],
      roster: "orc",
      ruleset: "season_3",
    });
    // 940k − 100k (bakés) + 90k, et non 940k − 80k + 90k.
    expect(JSON.parse(out as string).currentValue).toBe(930_000);
  });

  it("libellé baké inconnu du roster : retombe sur le journalier re-dérivé du même rang", () => {
    const out = rebakeFrozenJourneymen({
      raw: frozen({
        players: [
          { name: "J1", position: "orc_blitzer", number: 1, spp: 0 },
          { ...toFrozenJourneymanEntry(orcs[0]), position: "Journalier (Poste disparu)" },
          toFrozenJourneymanEntry(orcs[1]),
        ],
      }),
      previous: [goblin("journeyman-home-1", 12), orc("journeyman-home-2", 13)],
      next: [],
      roster: "orc",
      ruleset: "season_3",
    });
    // 940k − (40k re-dérivé + 50k baké).
    expect(JSON.parse(out as string).currentValue).toBe(850_000);
  });

  it("suit un contingent qui disparaît", () => {
    const snap = JSON.parse(
      rebakeFrozenJourneymen({ raw: frozen(), previous: orcs, next: [] }) as string,
    );
    expect(snap.players).toHaveLength(1);
    expect(snap.currentValue).toBe(840_000);
    expect(snap.journeymenValue).toBe(0);
  });

  it("rien à re-baker : absent, illisible, en-tête seul, sans roster", () => {
    const io = { previous: orcs, next: orcs };
    expect(rebakeFrozenJourneymen({ raw: null, ...io })).toBeNull();
    expect(rebakeFrozenJourneymen({ raw: "not-json", ...io })).toBeNull();
    expect(
      rebakeFrozenJourneymen({ raw: { headerOnly: true, currentValue: 1 }, ...io }),
    ).toBeNull();
    expect(rebakeFrozenJourneymen({ raw: { currentValue: 1 }, ...io })).toBeNull();
  });
});

describe("sumJourneymenValue / toFrozenJourneymanEntry", () => {
  it("somme les coûts du contingent", () => {
    expect(sumJourneymenValue([{ cost: 50_000 }, { cost: 40_000 }])).toBe(90_000);
    expect(sumJourneymenValue([])).toBe(0);
  });

  it("bake un journalier sous le libellé reconnu par parseFrozenSheetRoster", () => {
    const entry = toFrozenJourneymanEntry({
      id: "journeyman-home-1",
      number: 12,
      name: "Journalier 1",
      position: "orc_trois_quart_gobelin",
      positionName: "Journalier (Trois-quart Gobelin)",
      stats: { ma: 6, st: 2, ag: 3, pa: 4, av: 8 },
      skills: "stunty,right-stuff,dodge,loner-4",
      cost: 40_000,
    });
    expect(entry).toEqual({
      name: "Journalier 1",
      position: "Journalier (Trois-quart Gobelin)",
      number: 12,
      ma: 6,
      st: 2,
      ag: 3,
      pa: 4,
      av: 8,
      skills: "stunty,right-stuff,dodge,loner-4",
      spp: 0,
      advancements: "[]",
    });
    const parsed = parseFrozenSheetRoster({ players: [entry] });
    expect(parsed?.journeymen).toEqual([{ number: 12, name: "Journalier 1" }]);
    expect(parsed?.players).toEqual([]);
  });
});

describe("linemanPositionsForRoster — Trois-quarts à quota réduit", () => {
  // Règle publiée : « si la fiche d'équipe propose plusieurs postes de
  // Trois-quart, le coach choisit le type de journalier ». Le seul seuil
  // 0-12 ratait le Trois-quart Gobelin des Orques (0-4).
  it("propose les DEUX Trois-quarts du roster orque", () => {
    const slugs = linemanPositionsForRoster("orc", "season_3").map(
      (o) => o.slug,
    );
    expect(slugs).toContain("orc_trois_quart_orque");
    expect(slugs).toContain("orc_trois_quart_gobelin");
  });

  it("garde le Trois-quart 0-16 en TÊTE (défaut inchangé)", () => {
    expect(linemanPositionsForRoster("orc", "season_3")[0].slug).toBe(
      "orc_trois_quart_orque",
    );
  });

  it("n'ouvre pas un poste qui n'est pas un Trois-quart", () => {
    const slugs = linemanPositionsForRoster("orc", "season_3").map(
      (o) => o.slug,
    );
    expect(slugs).not.toContain("orc_blitzer_orque");
    expect(slugs).not.toContain("orc_troll");
  });

  it("retient un Trois-quart déclaré par les mots-clés de la BASE", () => {
    const options = linemanPositionsForRoster("roster-x", undefined, [
      {
        slug: "x_lineman",
        displayName: "Trois-quart X",
        cost: 50,
        max: 16,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "",
      },
      {
        slug: "x_petit",
        displayName: "Petit X",
        cost: 40,
        max: 4,
        ma: 6,
        st: 2,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "",
        keywords: "Gobelin, Trois-quart",
      },
      {
        slug: "x_blitzer",
        displayName: "Blitzer X",
        cost: 90,
        max: 4,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 10,
        skills: "",
        keywords: "X, Blitzer",
      },
    ]);
    expect(options.map((o) => o.slug)).toEqual(["x_lineman", "x_petit"]);
  });
});

describe("deriveJourneymen — un poste par journalier", () => {
  // 9 joueurs disponibles => 2 journaliers.
  const orcInput = {
    side: "home" as const,
    roster: "orc",
    ruleset: "season_3",
    players: players(9),
  };

  it("panache les postes selon le rang", () => {
    const derived = deriveJourneymen({
      ...orcInput,
      chosenPositions: ["orc_trois_quart_gobelin", "orc_trois_quart_orque"],
    });
    expect(derived.map((j) => j.position)).toEqual([
      "orc_trois_quart_gobelin",
      "orc_trois_quart_orque",
    ]);
    // Chaque journalier porte les stats ET le coût de SON poste.
    expect(derived[0].cost).toBe(40_000);
    expect(derived[1].cost).toBe(50_000);
    expect(derived[0].stats.st).toBe(2);
    expect(derived[1].stats.st).toBe(3);
  });

  it("un rang sans choix retombe sur le choix global", () => {
    const derived = deriveJourneymen({
      ...orcInput,
      chosenPosition: "orc_trois_quart_gobelin",
      chosenPositions: ["orc_trois_quart_orque", null],
    });
    expect(derived.map((j) => j.position)).toEqual([
      "orc_trois_quart_orque",
      "orc_trois_quart_gobelin",
    ]);
  });

  it("un rang sans choix ET sans choix global retombe sur le Trois-quart de base", () => {
    const derived = deriveJourneymen({
      ...orcInput,
      chosenPositions: [null, "orc_trois_quart_gobelin"],
    });
    expect(derived.map((j) => j.position)).toEqual([
      "orc_trois_quart_orque",
      "orc_trois_quart_gobelin",
    ]);
  });

  it("ignore un slug inconnu du roster (pas de journalier fantôme)", () => {
    const derived = deriveJourneymen({
      ...orcInput,
      chosenPositions: ["orc_troll", "slug-inexistant"],
    });
    expect(derived.map((j) => j.position)).toEqual([
      "orc_trois_quart_orque",
      "orc_trois_quart_orque",
    ]);
  });

  it("chaque journalier garde Solitaire (4+)", () => {
    const derived = deriveJourneymen({
      ...orcInput,
      chosenPositions: ["orc_trois_quart_gobelin", null],
    });
    for (const j of derived) {
      expect(j.skills.split(",")).toContain("loner-4");
    }
  });
});

describe("parseJourneymenChoices", () => {
  it("lit les deux formes (objet natif PG)", () => {
    expect(
      parseJourneymenChoices({ position: "a", positions: ["b", null, "c"] }),
    ).toEqual({ position: "a", positions: ["b", null, "c"] });
  });

  it("lit la chaîne JSON du miroir sqlite", () => {
    expect(
      parseJourneymenChoices(JSON.stringify({ positions: ["b"] })),
    ).toEqual({ position: null, positions: ["b"] });
  });

  it("reste tolérant : null, chaîne illisible, entrées non-string", () => {
    expect(parseJourneymenChoices(null)).toEqual({
      position: null,
      positions: [],
    });
    expect(parseJourneymenChoices("{oops")).toEqual({
      position: null,
      positions: [],
    });
    expect(parseJourneymenChoices({ positions: [1, "", "ok"] })).toEqual({
      position: null,
      positions: [null, null, "ok"],
    });
  });

  it("parseJourneymenChoice ne rend que le choix global (rétro-compat)", () => {
    expect(parseJourneymenChoice({ position: "a", positions: ["b"] })).toBe(
      "a",
    );
  });

  it("journeymenChoiceInput s'étale dans un DeriveJourneymenInput", () => {
    expect(journeymenChoiceInput({ position: "a", positions: ["b"] })).toEqual({
      chosenPosition: "a",
      chosenPositions: ["b"],
    });
  });
});
