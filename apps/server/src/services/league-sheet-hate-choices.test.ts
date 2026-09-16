/**
 * Haine (X) — dérivation des candidats et fusion des choix (module PUR).
 */

import { describe, it, expect } from "vitest";
import {
  buildHateCandidateViews,
  hateChoiceMap,
  mergeHateChoices,
  parseHateChoices,
} from "./league-sheet-hate-choices";

/** Un Zombie porte trois lignées : c'est le cas qui motive le choix. */
const ZOMBIE = "Humain, Mort-Vivant, Zombie, Trois-quart";
/** Un Trois-quart humain n'en porte qu'une. */
const HUMAN_LINEMAN = "Humain, Trois-quart";

describe("parseHateChoices", () => {
  it("accepte l'array natif (PG) et la chaîne JSON (miroir SQLite)", () => {
    const expected = [{ victimPlayerId: "v1", keyword: "Mort-Vivant" }];
    expect(parseHateChoices(expected)).toEqual(expected);
    expect(parseHateChoices(JSON.stringify(expected))).toEqual(expected);
  });

  it("ignore null, les formes invalides et les entrées incomplètes", () => {
    expect(parseHateChoices(null)).toEqual([]);
    expect(parseHateChoices(undefined)).toEqual([]);
    expect(parseHateChoices("pas du json")).toEqual([]);
    expect(parseHateChoices({ victimPlayerId: "v1" })).toEqual([]);
    expect(
      parseHateChoices([
        { victimPlayerId: "", keyword: "Humain" },
        { victimPlayerId: "v1", keyword: "   " },
        { victimPlayerId: "v2", keyword: 42 },
        null,
      ]),
    ).toEqual([]);
  });

  // Un joueur ne hait qu'un Mot-clé par match. La PREMIÈRE entrée gagne :
  // stable d'une lecture à l'autre, là où « la dernière » serait arbitraire.
  it("dédoublonne par victime en gardant la première entrée", () => {
    expect(
      parseHateChoices([
        { victimPlayerId: "v1", keyword: "Humain" },
        { victimPlayerId: "v1", keyword: "Zombie" },
      ]),
    ).toEqual([{ victimPlayerId: "v1", keyword: "Humain" }]);
  });
});

describe("hateChoiceMap", () => {
  it("indexe par victime", () => {
    const map = hateChoiceMap([
      { victimPlayerId: "v1", keyword: "Zombie" },
      { victimPlayerId: "v2", keyword: "Humain" },
    ]);
    expect(map.get("v1")).toBe("Zombie");
    expect(map.get("v3")).toBeUndefined();
  });
});

describe("buildHateCandidateViews", () => {
  const keywords = new Map([
    ["zombie-1", ZOMBIE],
    ["human-1", HUMAN_LINEMAN],
    ["blitzer-only", "Blitzer, Coureur"],
  ]);

  it("propose TOUS les mots-clés de lignée de l'auteur", () => {
    const [view] = buildHateCandidateViews({
      injuries: [
        { victimPlayerId: "v1", side: "home", causerPlayerId: "zombie-1" },
      ],
      keywordsByPlayerId: keywords,
      choices: [],
    });
    expect(view.keywords).toEqual(["Humain", "Mort-Vivant", "Zombie"]);
    // Sans choix : premier éligible, comme avant ce champ.
    expect(view.keyword).toBe("Humain");
    expect(view.chosen).toBe(false);
    expect(view.side).toBe("home");
    expect(view.causerPlayerId).toBe("zombie-1");
  });

  it("retient le choix stocké", () => {
    const [view] = buildHateCandidateViews({
      injuries: [
        { victimPlayerId: "v1", side: "away", causerPlayerId: "zombie-1" },
      ],
      keywordsByPlayerId: keywords,
      choices: [{ victimPlayerId: "v1", keyword: "Mort-Vivant" }],
    });
    expect(view.keyword).toBe("Mort-Vivant");
    expect(view.chosen).toBe(true);
  });

  // Le choix DÉSIGNANT le premier mot-clé reste un choix : `chosen` ne se
  // déduit pas de « ce n'est pas le défaut ».
  it("marque comme choisi un choix qui désigne le premier mot-clé", () => {
    const [view] = buildHateCandidateViews({
      injuries: [
        { victimPlayerId: "v1", side: "home", causerPlayerId: "zombie-1" },
      ],
      keywordsByPlayerId: keywords,
      choices: [{ victimPlayerId: "v1", keyword: "humain" }],
    });
    expect(view.keyword).toBe("Humain");
    expect(view.chosen).toBe(true);
  });

  // L'auteur a été corrigé après la saisie du choix : on ne fait échouer
  // personne, on retombe sur le premier mot-clé du NOUVEL auteur.
  it("retombe sur le défaut quand le choix n'est plus éligible", () => {
    const [view] = buildHateCandidateViews({
      injuries: [
        { victimPlayerId: "v1", side: "home", causerPlayerId: "human-1" },
      ],
      keywordsByPlayerId: keywords,
      choices: [{ victimPlayerId: "v1", keyword: "Zombie" }],
    });
    expect(view.keywords).toEqual(["Humain"]);
    expect(view.keyword).toBe("Humain");
    expect(view.chosen).toBe(false);
  });

  it("écarte les blessures sans auteur, sans mots-clés connus, ou de poste seul", () => {
    expect(
      buildHateCandidateViews({
        injuries: [
          { victimPlayerId: "v1", side: "home", causerPlayerId: null },
          { victimPlayerId: "v2", side: "home", causerPlayerId: "inconnu" },
          { victimPlayerId: "v3", side: "home", causerPlayerId: "blitzer-only" },
        ],
        keywordsByPlayerId: keywords,
        choices: [],
      }),
    ).toEqual([]);
  });

  // La règle n'accorde qu'un trait par joueur blessé et par match : le
  // premier auteur consigné fait foi.
  it("dédoublonne par victime blessée deux fois", () => {
    const views = buildHateCandidateViews({
      injuries: [
        { victimPlayerId: "v1", side: "home", causerPlayerId: "zombie-1" },
        { victimPlayerId: "v1", side: "home", causerPlayerId: "human-1" },
      ],
      keywordsByPlayerId: keywords,
      choices: [{ victimPlayerId: "v1", keyword: "Zombie" }],
    });
    expect(views).toHaveLength(1);
    expect(views[0].causerPlayerId).toBe("zombie-1");
    expect(views[0].keyword).toBe("Zombie");
  });
});

describe("mergeHateChoices", () => {
  const allowed = new Set(["v1", "v2"]);

  it("ajoute sans perdre le choix déjà posé de l'autre côté", () => {
    expect(
      mergeHateChoices({
        current: [{ victimPlayerId: "v1", keyword: "Humain" }],
        incoming: [{ victimPlayerId: "v2", keyword: "Zombie" }],
        allowedVictimIds: allowed,
      }),
    ).toEqual([
      { victimPlayerId: "v1", keyword: "Humain" },
      { victimPlayerId: "v2", keyword: "Zombie" },
    ]);
  });

  it("remplace le choix d'une même victime", () => {
    expect(
      mergeHateChoices({
        current: [{ victimPlayerId: "v1", keyword: "Humain" }],
        incoming: [{ victimPlayerId: "v1", keyword: "Mort-Vivant" }],
        allowedVictimIds: allowed,
      }),
    ).toEqual([{ victimPlayerId: "v1", keyword: "Mort-Vivant" }]);
  });

  it("retire le choix sur null ou chaîne vide (retour au défaut)", () => {
    expect(
      mergeHateChoices({
        current: [{ victimPlayerId: "v1", keyword: "Humain" }],
        incoming: [{ victimPlayerId: "v1", keyword: null }],
        allowedVictimIds: allowed,
      }),
    ).toEqual([]);
    expect(
      mergeHateChoices({
        current: [{ victimPlayerId: "v1", keyword: "Humain" }],
        incoming: [{ victimPlayerId: "v1", keyword: "  " }],
        allowedVictimIds: allowed,
      }),
    ).toEqual([]);
  });

  it("ignore une victime qui n'est plus candidate", () => {
    expect(
      mergeHateChoices({
        current: [],
        incoming: [{ victimPlayerId: "inconnu", keyword: "Humain" }],
        allowedVictimIds: allowed,
      }),
    ).toEqual([]);
  });
});
