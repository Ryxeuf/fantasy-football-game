/**
 * Joueur relevé pendant le match — dérivation pure, éligibilité de la
 * victime, recrutement d'après-match — pour les DEUX règles :
 *
 *  - Maîtres de la Non-vie (« Relever le Mort ») : un adversaire de Force ≤ 4
 *    sans Minus qui subit un résultat Mort, quelle qu'en soit la cause ;
 *    embauche GRATUITE ;
 *  - Trait Contagieux (Nurgle) : un adversaire tué sur un BLOCAGE d'un porteur
 *    du Trait, ni Gros Bras, ni Décomposition, ni Régénération, ni Minus ;
 *    embauche AU PRIX du poste, comme un journalier.
 */

import { describe, it, expect } from "vitest";
import { surchargeForAdvancement } from "@bb/game-engine";
import {
  MASTERS_OF_UNDEATH_RULE,
  PLAGUE_RIDDEN_POSITION_PREFIX,
  RAISED_DEAD_ID_PREFIX,
  RAISED_DEAD_POSITION_PREFIX,
  buildRaisedDeadHire,
  canHireRaisedDead,
  deriveRaisedDead,
  eligibleRaiseVictims,
  hasMastersOfUndeath,
  hasPlagueRiddenTrait,
  isBigGuyVictim,
  isFreeRaise,
  isRaisedDeadId,
  parseRaisedDeadChoice,
  raiseSourcesFor,
  raisedDeadIdFor,
  raisedDeadPositionOptions,
  raisedDeadPositionPrefix,
  raisedDeadSide,
  type RaiseVictimSource,
  type SheetRaisedDead,
} from "./league-sheet-raised-dead";

const SKELETON = "undead_trois_quart_squelette";
const ZOMBIE = "undead_trois_quart_zombie";
const ROTTER = "nurgle_trois_quart_putrescent";

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

/** Un joueur du côté qui relève (auteur possible d'un blocage). */
function own(over: Partial<RaiseVictimSource> = {}): RaiseVictimSource {
  return {
    id: "h1",
    number: 1,
    name: "Pourri 1",
    positionName: "Trois-Quart Putrescent",
    stats: { st: 3 },
    skills: "contagieux,decay",
    ...over,
  };
}

const DEAD_A1 = { playerId: "a1", severity: "dead", side: "away" as const };
/** Mort sur un blocage du Pourri n°1 (cause `casualty` = blocage). */
const BLOCKED_A1 = {
  ...DEAD_A1,
  cause: "casualty",
  causedByPlayerId: "h1",
};

describe("ids synthétiques `raised-<side>-1`", () => {
  it("reconnaît un joueur relevé et son côté", () => {
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

describe("hasPlagueRiddenTrait", () => {
  it("reconnaît les deux slugs du Trait Contagieux (Saison 3 et catalogue antérieur)", () => {
    expect(hasPlagueRiddenTrait("contagieux,decay")).toBe(true);
    expect(hasPlagueRiddenTrait("plague-ridden,monstrous-mouth,loner-4")).toBe(
      true,
    );
    expect(hasPlagueRiddenTrait(" Contagieux ")).toBe(true);
    expect(hasPlagueRiddenTrait("decay,regeneration")).toBe(false);
    expect(hasPlagueRiddenTrait("")).toBe(false);
    expect(hasPlagueRiddenTrait(null)).toBe(false);
  });
});

describe("raiseSourcesFor", () => {
  it("la règle spéciale donne Maîtres, un porteur du Trait donne Contagieux, la gratuite en premier", () => {
    expect(
      raiseSourcesFor({
        specialRules: [MASTERS_OF_UNDEATH_RULE],
        players: [{ skills: "regeneration" }],
      }),
    ).toEqual(["masters_of_undeath"]);
    expect(
      raiseSourcesFor({
        specialRules: ["bagarreurs_brutaux", "favori_de"],
        players: [{ skills: "" }, { skills: "contagieux,decay" }],
      }),
    ).toEqual(["plague_ridden"]);
    // Morts-Vivants qui engagent Guffle Pussmaw (plague-ridden).
    expect(
      raiseSourcesFor({
        specialRules: [MASTERS_OF_UNDEATH_RULE],
        players: [{ skills: "plague-ridden,loner-4" }],
      }),
    ).toEqual(["masters_of_undeath", "plague_ridden"]);
    expect(raiseSourcesFor({ specialRules: [], players: [] })).toEqual([]);
    expect(
      raiseSourcesFor({ specialRules: null, players: [{ skills: null }] }),
    ).toEqual([]);
  });
});

describe("isBigGuyVictim", () => {
  it("le Mot-clé « Gros Bras » fait foi quand il est connu", () => {
    expect(isBigGuyVictim({ keywords: "Rejeton, Gros Bras", skills: "" })).toBe(
      true,
    );
    expect(isBigGuyVictim({ keywords: "Ogre, Gros Bras", skills: null })).toBe(
      true,
    );
    // Un Star Player a Solitaire sans être un Gros Bras.
    expect(
      isBigGuyVictim({ keywords: "Humain, Blitzer", skills: "block,loner-4" }),
    ).toBe(false);
  });

  it("sans mots-clés, l'heuristique du moteur (Solitaire) tranche", () => {
    expect(
      isBigGuyVictim({ keywords: null, skills: "loner-4,bone-head" }),
    ).toBe(true);
    expect(isBigGuyVictim({ skills: "block,dodge" })).toBe(false);
    expect(isBigGuyVictim({ keywords: undefined, skills: null })).toBe(false);
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

describe("eligibleRaiseVictims — Maîtres de la Non-vie", () => {
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
      source: "masters_of_undeath",
    });
  });

  it("sans `sources`, seule la règle Maîtres est jouée (compatibilité)", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [BLOCKED_A1],
      opponents: [opponent()],
      own: [own()],
    });
    expect(out.map((v) => v.source)).toEqual(["masters_of_undeath"]);
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

  it("aucune source : personne n'est relevable", () => {
    expect(
      eligibleRaiseVictims({
        side: "home",
        injuries: [BLOCKED_A1],
        opponents: [opponent()],
        sources: [],
        own: [own()],
      }),
    ).toEqual([]);
  });
});

describe("eligibleRaiseVictims — Trait Contagieux", () => {
  const PLAGUE = ["plague_ridden"] as const;

  it("un adversaire tué sur un BLOCAGE d'un porteur du Trait est contaminable", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [BLOCKED_A1],
      opponents: [opponent()],
      sources: PLAGUE,
      own: [own()],
    });
    expect(out).toEqual([
      {
        id: "a1",
        number: 1,
        name: "Grommit",
        positionName: "Trois-quart Humain",
        source: "plague_ridden",
      },
    ]);
  });

  it("la Force de la victime n'entre pas en compte (pas de plafond à 4)", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [BLOCKED_A1],
      opponents: [opponent({ stats: { st: 5 }, keywords: "Humain, Bloqueur" })],
      sources: PLAGUE,
      own: [own()],
    });
    expect(out).toHaveLength(1);
  });

  it("seule une Élimination sur Blocage compte : agression, public, chute ne contaminent pas", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [
        {
          ...DEAD_A1,
          playerId: "foul",
          cause: "aggression",
          causedByPlayerId: "h1",
        },
        {
          ...DEAD_A1,
          playerId: "crowd",
          cause: "crowd_surge",
          causedByPlayerId: null,
        },
        {
          ...DEAD_A1,
          playerId: "fall",
          cause: "other_elim",
          causedByPlayerId: null,
        },
        { ...DEAD_A1, playerId: "self", cause: "self", causedByPlayerId: null },
        {
          ...DEAD_A1,
          playerId: "blitz",
          cause: "blitz",
          causedByPlayerId: "h1",
        },
      ],
      opponents: [
        opponent({ id: "foul" }),
        opponent({ id: "crowd" }),
        opponent({ id: "fall" }),
        opponent({ id: "self" }),
        opponent({ id: "blitz" }),
      ],
      sources: PLAGUE,
      own: [own()],
    });
    expect(out.map((v) => v.id)).toEqual(["blitz"]);
  });

  it("l'auteur du blocage doit AVOIR le Trait ; un blocage sans auteur ne compte pas", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [
        {
          ...BLOCKED_A1,
          playerId: "byStar",
          causedByPlayerId: "star-home-guffle",
        },
        { ...BLOCKED_A1, playerId: "byClean", causedByPlayerId: "h2" },
        { ...BLOCKED_A1, playerId: "noActor", causedByPlayerId: null },
        { ...BLOCKED_A1, playerId: "byStranger", causedByPlayerId: "a9" },
      ],
      opponents: [
        opponent({ id: "byStar" }),
        opponent({ id: "byClean" }),
        opponent({ id: "noActor" }),
        opponent({ id: "byStranger" }),
      ],
      sources: PLAGUE,
      own: [
        own({ id: "h2", skills: "block" }),
        own({
          id: "star-home-guffle",
          skills: "plague-ridden,monstrous-mouth,loner-4",
        }),
      ],
    });
    expect(out.map((v) => v.id)).toEqual(["byStar"]);
  });

  it("ni Gros Bras, ni Décomposition, ni Régénération, ni Minus", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [
        { ...BLOCKED_A1, playerId: "troll" },
        { ...BLOCKED_A1, playerId: "loner" },
        { ...BLOCKED_A1, playerId: "rotter" },
        { ...BLOCKED_A1, playerId: "zombie" },
        { ...BLOCKED_A1, playerId: "gob" },
        { ...BLOCKED_A1, playerId: "star" },
        { ...BLOCKED_A1, playerId: "ok" },
      ],
      opponents: [
        opponent({
          id: "troll",
          keywords: "Troll, Gros Bras",
          stats: { st: 5 },
        }),
        // Sans mots-clés : Solitaire vaut Gros Bras (heuristique du moteur).
        opponent({ id: "loner", skills: "loner-4,bone-head" }),
        opponent({ id: "rotter", skills: "contagieux,decay" }),
        opponent({ id: "zombie", skills: "regeneration" }),
        opponent({ id: "gob", skills: "dodge,stunty" }),
        // Star Player : Solitaire mais mots-clés connus, pas un Gros Bras.
        opponent({
          id: "star",
          keywords: "Humain, Blitzer",
          skills: "block,loner-4",
        }),
        opponent({ id: "ok", keywords: "Humain, Trois-quart" }),
      ],
      sources: PLAGUE,
      own: [own()],
    });
    expect(out.map((v) => v.id)).toEqual(["star", "ok"]);
  });

  it("avec les deux règles, la gratuite (Maîtres) l'emporte quand elle s'applique", () => {
    const out = eligibleRaiseVictims({
      side: "home",
      injuries: [BLOCKED_A1, { ...BLOCKED_A1, playerId: "strong" }],
      opponents: [
        opponent({ id: "a1" }),
        // Force 5 : hors Maîtres, mais contaminable.
        opponent({
          id: "strong",
          stats: { st: 5 },
          keywords: "Humain, Bloqueur",
        }),
      ],
      sources: ["masters_of_undeath", "plague_ridden"],
      own: [own({ id: "h1", skills: "plague-ridden,loner-4" })],
    });
    expect(out.map((v) => [v.id, v.source])).toEqual([
      ["a1", "masters_of_undeath"],
      ["strong", "plague_ridden"],
    ]);
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

  it("Nurgle n'a qu'un Trois-quart : le Putrescent", () => {
    expect(raisedDeadPositionOptions("nurgle").map((o) => o.slug)).toEqual([
      ROTTER,
    ]);
  });
});

describe("libellés et gratuité selon la source", () => {
  it("préfixe de poste et prix d'embauche", () => {
    expect(raisedDeadPositionPrefix("masters_of_undeath")).toBe(
      RAISED_DEAD_POSITION_PREFIX,
    );
    expect(raisedDeadPositionPrefix("plague_ridden")).toBe(
      PLAGUE_RIDDEN_POSITION_PREFIX,
    );
    expect(isFreeRaise("masters_of_undeath")).toBe(true);
    expect(isFreeRaise("plague_ridden")).toBe(false);
  });
});

describe("deriveRaisedDead", () => {
  const VICTIM = {
    id: "a1",
    number: 1,
    name: "Grommit",
    positionName: "Trois-quart Humain",
    source: "masters_of_undeath" as const,
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

  it("dérive un Trois-quart de la fiche au poste choisi, sans Solitaire, au numéro suivant — gratuit", () => {
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
      source: "masters_of_undeath",
      hireCost: 0,
    });
    const skills = out!.skills.split(",");
    expect(skills).toContain("regeneration");
    expect(skills.some((sk) => sk.startsWith("loner"))).toBe(false);
  });

  it("un Contaminé de Nurgle : Trois-Quart Putrescent, libellé « Contaminé », embauche au prix du poste", () => {
    const out = deriveRaisedDead({
      ...base,
      roster: "nurgle",
      victims: [{ ...VICTIM, source: "plague_ridden" }],
      takenNumbers: [1, 2, 3],
      choice: { victimId: "a1", position: null },
    });
    expect(out).toMatchObject({
      id: "raised-home-1",
      number: 4,
      name: "Grommit",
      position: ROTTER,
      positionName: "Contaminé (Trois-Quart Putrescent)",
      cost: 40_000,
      source: "plague_ridden",
      hireCost: 40_000,
    });
    const skills = out!.skills.split(",");
    expect(skills).toContain("contagieux");
    expect(skills).toContain("decay");
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
    source: "masters_of_undeath",
    hireCost: 0,
  };
  const INFECTED: SheetRaisedDead = {
    ...RAISED,
    position: ROTTER,
    positionName: "Contaminé (Trois-Quart Putrescent)",
    skills: "contagieux,decay",
    source: "plague_ridden",
    hireCost: 40_000,
  };

  it("mort relevé : GRATUIT mais vaut le poste, et garde les PSP du match", () => {
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

  it("Contaminé : AU PRIX du poste, comme un journalier, PSP conservés", () => {
    const hire = buildRaisedDeadHire({ raised: INFECTED, earnedSpp: 3 });
    expect(hire).toMatchObject({
      advancementTaken: false,
      cost: 40_000,
      value: 40_000,
      spp: 3,
      skills: INFECTED.skills,
    });
  });

  it("prend l'évolution de l'étape 3 si les PSP suffisent : le relevé reste gratuit, le Contaminé paie le surcoût", () => {
    const surcharge = surchargeForAdvancement({ type: "primary" });
    const advancement = {
      type: "primary" as const,
      skillSlug: "block",
      pspCost: 6,
      valueSurcharge: surcharge,
    };
    const free = buildRaisedDeadHire({
      raised: RAISED,
      earnedSpp: 7,
      advancement,
    });
    expect(free.advancementTaken).toBe(true);
    expect(free.cost).toBe(0);
    expect(free.value).toBe(40_000 + surcharge);
    expect(free.spp).toBe(1);
    expect(free.skills.split(",")).toContain("block");
    expect(JSON.parse(free.advancements)).toEqual([
      { skillSlug: "block", type: "primary", isRandom: false, at: 0 },
    ]);

    const paid = buildRaisedDeadHire({
      raised: INFECTED,
      earnedSpp: 7,
      advancement,
    });
    expect(paid.advancementTaken).toBe(true);
    expect(paid.cost).toBe(40_000 + surcharge);
    expect(paid.value).toBe(40_000 + surcharge);
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
