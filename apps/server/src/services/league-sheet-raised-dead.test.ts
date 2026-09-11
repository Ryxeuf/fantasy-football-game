/**
 * Maîtres de la Non-vie — « Relever le Mort » : dérivation pure du
 * Trois-quart relevé, éligibilité de la victime, recrutement gratuit.
 *
 * Règle : une fois par match, un adversaire de Force ≤ 4 sans le Trait Minus
 * qui subit un résultat Mort peut être relevé en Trois-quart de la fiche
 * d'équipe (Zombie ou Squelette chez les Morts-Vivants), qui va en réserve
 * et peut être embauché gratuitement en fin de match (16 joueurs max).
 */

import { describe, it, expect } from "vitest";
import { surchargeForAdvancement } from "@bb/game-engine";
import {
  MASTERS_OF_UNDEATH_RULE,
  RAISED_DEAD_ID_PREFIX,
  buildRaisedDeadHire,
  canHireRaisedDead,
  deriveRaisedDead,
  eligibleRaiseVictims,
  hasMastersOfUndeath,
  isRaisedDeadId,
  parseRaisedDeadChoice,
  raisedDeadIdFor,
  raisedDeadPositionOptions,
  raisedDeadSide,
  type RaiseVictimSource,
  type SheetRaisedDead,
} from "./league-sheet-raised-dead";

const SKELETON = "undead_trois_quart_squelette";
const ZOMBIE = "undead_trois_quart_zombie";

function opponent(over: Partial<RaiseVictimSource> = {}): RaiseVictimSource {
  return {
    id: "a1",
    number: 1,
    name: "Grommit",
    positionName: "Trois-quart Humain",
    stats: { st: 3 },
    skills: "",
    ...over,
  };
}

const DEAD_A1 = { playerId: "a1", severity: "dead", side: "away" as const };

describe("ids synthétiques `raised-<side>-1`", () => {
  it("reconnaît un mort relevé et son côté", () => {
    expect(raisedDeadIdFor("home")).toBe(`${RAISED_DEAD_ID_PREFIX}home-1`);
    expect(isRaisedDeadId("raised-home-1")).toBe(true);
    expect(isRaisedDeadId("journeyman-home-1")).toBe(false);
    expect(isRaisedDeadId(null)).toBe(false);
    expect(raisedDeadSide("raised-home-1")).toBe("home");
    expect(raisedDeadSide("raised-away-1")).toBe("away");
    expect(raisedDeadSide("raised-north-1")).toBeNull();
    expect(raisedDeadSide("clx123")).toBeNull();
  });
});

describe("hasMastersOfUndeath", () => {
  it("lit la règle spéciale dans la liste résolue (base ou catalogue)", () => {
    expect(hasMastersOfUndeath([MASTERS_OF_UNDEATH_RULE])).toBe(true);
    expect(hasMastersOfUndeath([" maitres_de_la_non_vie "])).toBe(true);
    expect(hasMastersOfUndeath(["bagarreurs_brutaux"])).toBe(false);
    expect(hasMastersOfUndeath([])).toBe(false);
    expect(hasMastersOfUndeath(null)).toBe(false);
  });
});

describe("parseRaisedDeadChoice", () => {
  it("lit l'objet natif (PG) et la chaîne JSON (miroir sqlite)", () => {
    expect(parseRaisedDeadChoice({ victimId: "a1", position: ZOMBIE })).toEqual(
      { victimId: "a1", position: ZOMBIE },
    );
    expect(parseRaisedDeadChoice(JSON.stringify({ victimId: "a1" }))).toEqual({
      victimId: "a1",
      position: null,
    });
  });

  it("vaut « pas relevé » sans victime exploitable", () => {
    expect(parseRaisedDeadChoice(null)).toBeNull();
    expect(parseRaisedDeadChoice(undefined)).toBeNull();
    expect(parseRaisedDeadChoice({ position: ZOMBIE })).toBeNull();
    expect(parseRaisedDeadChoice({ victimId: "" })).toBeNull();
    expect(parseRaisedDeadChoice("{pas du json")).toBeNull();
    expect(parseRaisedDeadChoice(42)).toBeNull();
  });
});

describe("eligibleRaiseVictims", () => {
  it("retient les adversaires MORTS de Force ≤ 4 sans Minus, dans l'ordre adverse", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [
        { playerId: "a3", severity: "dead", side: "away" },
        DEAD_A1,
        { playerId: "a2", severity: "mng", side: "away" },
      ],
      opponents: [
        opponent({ id: "a1", number: 1, name: "Grommit" }),
        opponent({ id: "a2", number: 2, name: "Blessé" }),
        opponent({ id: "a3", number: 3, name: "Zog" }),
      ],
    });
    expect(out.map((v) => v.id)).toEqual(["a1", "a3"]);
    expect(out[0]).toEqual({
      id: "a1",
      number: 1,
      name: "Grommit",
      positionName: "Trois-quart Humain",
    });
  });

  it("écarte un mort de Force 5+ et un porteur du Trait Minus (stunty)", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [
        { playerId: "big", severity: "dead", side: "away" },
        { playerId: "gob", severity: "dead", side: "away" },
        { playerId: "micro", severity: "dead", side: "away" },
      ],
      opponents: [
        opponent({ id: "big", stats: { st: 5 } }),
        opponent({ id: "gob", skills: "dodge,right-stuff,stunty" }),
        // Microbe (titchy) n'est PAS Minus : relevable.
        opponent({ id: "micro", skills: "dodge,titchy" }),
      ],
    });
    expect(out.map((v) => v.id)).toEqual(["micro"]);
  });

  it("Force 4 exactement reste relevable (« 4 ou moins »)", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [DEAD_A1],
      opponents: [opponent({ stats: { st: 4 } })],
    });
    expect(out).toHaveLength(1);
  });

  it("ne relève jamais ses PROPRES morts", () => {
    const out = eligibleRaiseVictims({
      side: "away",
      injuries: [DEAD_A1],
      opponents: [opponent()],
    });
    expect(out).toEqual([]);
  });

  it("un journalier ou un Star Player adverse mort est relevable comme un autre", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [
        { playerId: "journeyman-away-1", severity: "dead", side: "away" },
      ],
      opponents: [
        opponent({
          id: "journeyman-away-1",
          number: 12,
          name: "Journalier 1",
          positionName: "Journalier (Trois-quart Humain)",
          skills: "loner-4",
        }),
      ],
    });
    expect(out.map((v) => v.id)).toEqual(["journeyman-away-1"]);
  });

  it("dédoublonne une victime consignée deux fois", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [DEAD_A1, DEAD_A1],
      opponents: [opponent(), opponent()],
    });
    expect(out).toHaveLength(1);
  });
});

describe("raisedDeadPositionOptions", () => {
  it("propose les DEUX Trois-quarts des Morts-Vivants, le Squelette de base en premier", () => {
    expect(raisedDeadPositionOptions("undead").map((o) => o.slug)).toEqual([
      SKELETON,
      ZOMBIE,
    ]);
    expect(raisedDeadPositionOptions("tomb_kings").map((o) => o.slug)).toEqual([
      "tomb_kings_trois_quart_squelette",
    ]);
    expect(raisedDeadPositionOptions("vampire").map((o) => o.slug)).toEqual([
      "vampire_trois_quart_sbire",
    ]);
  });
});

describe("deriveRaisedDead", () => {
  const VICTIM = {
    id: "a1",
    number: 1,
    name: "Grommit",
    positionName: "Trois-quart Humain",
  };
  const base = {
    side: "home" as const,
    roster: "undead",
    victims: [VICTIM],
    takenNumbers: [1, 2, 3, 11, 12],
  };

  it("rien de relevé sans choix", () => {
    expect(deriveRaisedDead({ ...base, choice: null })).toBeNull();
  });

  it("un choix qui ne désigne plus un mort relevable ne produit rien (sortie retirée)", () => {
    expect(
      deriveRaisedDead({
        ...base,
        victims: [],
        choice: { victimId: "a1", position: ZOMBIE },
      }),
    ).toBeNull();
  });

  it("dérive un Trois-quart de la fiche au poste choisi, sans Solitaire, au numéro suivant", () => {
    const out = deriveRaisedDead({
      ...base,
      choice: { victimId: "a1", position: ZOMBIE },
    });
    expect(out).toMatchObject({
      id: "raised-home-1",
      number: 13,
      name: "Grommit",
      position: ZOMBIE,
      positionName: "Mort relevé (Trois-quart Zombie)",
      stats: { st: 3 },
      cost: 40_000,
      victimId: "a1",
    });
    const skills = out!.skills.split(",");
    expect(skills).toContain("regeneration");
    expect(skills.some((sk) => sk.startsWith("loner"))).toBe(false);
  });

  it("retombe sur le Trois-quart de base sans choix de poste ou avec un poste inconnu", () => {
    expect(
      deriveRaisedDead({ ...base, choice: { victimId: "a1", position: null } })
        ?.position,
    ).toBe(SKELETON);
    expect(
      deriveRaisedDead({
        ...base,
        choice: { victimId: "a1", position: "undead_momie" },
      })?.position,
    ).toBe(SKELETON);
  });

  it("lit les postes de la BASE quand ils sont fournis (prix, stats, libellé)", () => {
    const out = deriveRaisedDead({
      ...base,
      choice: { victimId: "a1", position: ZOMBIE },
      positions: [
        {
          slug: ZOMBIE,
          displayName: "Zombie (édité)",
          cost: 45,
          max: 16,
          ma: 4,
          st: 3,
          ag: 4,
          pa: null,
          av: 9,
          skills: "regeneration",
        },
      ],
    });
    expect(out).toMatchObject({
      position: ZOMBIE,
      positionName: "Mort relevé (Zombie (édité))",
      cost: 45_000,
      skills: "regeneration",
    });
  });

  it("le côté extérieur relève sous `raised-away-1`", () => {
    const out = deriveRaisedDead({
      ...base,
      side: "away",
      choice: { victimId: "a1", position: null },
    });
    expect(out?.id).toBe("raised-away-1");
  });
});

describe("canHireRaisedDead", () => {
  it("embauche possible tant que la liste ne compte pas déjà 16 joueurs", () => {
    expect(canHireRaisedDead({ activePlayerCount: 15, maxPlayers: 16 })).toBe(
      true,
    );
    expect(canHireRaisedDead({ activePlayerCount: 16, maxPlayers: 16 })).toBe(
      false,
    );
  });
});

describe("buildRaisedDeadHire", () => {
  const RAISED: SheetRaisedDead = {
    id: "raised-home-1",
    number: 13,
    name: "Grommit",
    position: ZOMBIE,
    positionName: "Mort relevé (Trois-quart Zombie)",
    stats: { ma: 4, st: 3, ag: 4, pa: null, av: 9 },
    skills: "fork,instable,regeneration",
    cost: 40_000,
    victimId: "a1",
  };

  it("est GRATUIT mais vaut le poste, et garde les PSP du match", () => {
    const hire = buildRaisedDeadHire({ raised: RAISED, earnedSpp: 3 });
    expect(hire).toMatchObject({
      advancementTaken: false,
      cost: 0,
      value: 40_000,
      spp: 3,
      skills: RAISED.skills,
      advancements: "[]",
      stats: RAISED.stats,
    });
  });

  it("prend l'évolution de l'étape 3 si les PSP suffisent : toujours gratuit, valeur renchérie", () => {
    const surcharge = surchargeForAdvancement({ type: "primary" });
    const hire = buildRaisedDeadHire({
      raised: RAISED,
      earnedSpp: 7,
      advancement: {
        type: "primary",
        skillSlug: "block",
        pspCost: 6,
        valueSurcharge: surcharge,
      },
    });
    expect(hire.advancementTaken).toBe(true);
    expect(hire.cost).toBe(0);
    expect(hire.value).toBe(40_000 + surcharge);
    expect(hire.spp).toBe(1);
    expect(hire.skills.split(",")).toContain("block");
    expect(JSON.parse(hire.advancements)).toEqual([
      { skillSlug: "block", type: "primary", isRandom: false, at: 0 },
    ]);
  });

  it("PSP insuffisants : l'évolution n'est pas prise", () => {
    const hire = buildRaisedDeadHire({
      raised: RAISED,
      earnedSpp: 2,
      advancement: {
        type: "primary",
        skillSlug: "block",
        pspCost: 6,
        valueSurcharge: 20_000,
      },
    });
    expect(hire.advancementTaken).toBe(false);
    expect(hire.value).toBe(40_000);
    expect(hire.spp).toBe(2);
  });
});
