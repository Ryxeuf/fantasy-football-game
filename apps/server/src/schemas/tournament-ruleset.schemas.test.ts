/**
 * Le parser est la seule barrière entre un JSON libre en base et le moteur de
 * règles : il doit accepter exactement le registre du moteur et refuser, avec
 * un chemin exploitable par l'UI admin, tout ce qui rendrait un règlement
 * incohérent.
 */

import { describe, it, expect } from "vitest";
import { NAF_WORLD_CUP_2027 } from "@bb/game-engine";
import {
  parseDefinition,
  serializeDefinition,
} from "./tournament-ruleset.schemas";

/** Définition valide minimale, base des cas d'erreur. */
function validInput(over: Record<string, unknown> = {}) {
  return {
    ...serializeDefinition(NAF_WORLD_CUP_2027),
    ...over,
  };
}

describe("aller-retour avec le registre du moteur", () => {
  it("le pack NAF WC 2027 sérialisé se reparse à l'identique", () => {
    const parsed = parseDefinition(serializeDefinition(NAF_WORLD_CUP_2027));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.definition).toEqual(NAF_WORLD_CUP_2027);
  });

  it("Infinity ↔ null sur la dernière tranche de taxe Star Players", () => {
    const serialized = serializeDefinition(NAF_WORLD_CUP_2027);
    const last = serialized.starPlayerSppTax.at(-1);
    // JSON n'a pas d'Infinity : la borne ouverte est stockée en null.
    expect(last?.maxTotalCostK).toBeNull();
    expect(JSON.parse(JSON.stringify(serialized)).starPlayerSppTax.at(-1))
      .toEqual(last);

    const parsed = parseDefinition(serialized);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.definition.starPlayerSppTax.at(-1)?.maxTotalCostK).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("formes de stockage", () => {
  it("accepte un objet natif (PostgreSQL)", () => {
    expect(parseDefinition(validInput()).ok).toBe(true);
  });

  it("accepte une chaîne JSON sérialisée (miroir SQLite)", () => {
    expect(parseDefinition(JSON.stringify(validInput())).ok).toBe(true);
  });

  it("refuse une chaîne illisible", () => {
    const parsed = parseDefinition("{pas du json");
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0].message).toMatch(/JSON illisible/);
  });

  it("refuse null et les scalaires", () => {
    expect(parseDefinition(null).ok).toBe(false);
    expect(parseDefinition(42).ok).toBe(false);
  });
});

describe("erreurs pointées sur le champ fautif", () => {
  it("slug invalide", () => {
    const parsed = parseDefinition(validInput({ slug: "NAF WC 2027" }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0].path).toBe("slug");
  });

  it("édition inconnue", () => {
    const parsed = parseDefinition(validInput({ edition: "season_9" }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.some((i) => i.path === "edition")).toBe(true);
  });

  it("budget de tier hors bornes, chemin complet", () => {
    const parsed = parseDefinition(
      validInput({
        rosterRules: { orc: { goldBudget: -5, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false } },
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.some((i) => i.path === "rosterRules.orc.goldBudget"))
      .toBe(true);
  });

  it("cumul de compétences inconnu", () => {
    const parsed = parseDefinition(
      validInput({
        rosterRules: { orc: { goldBudget: 1080, sppBudget: 44, skillStacking: "trois_joueurs", starPlayersAllowed: false } },
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(
      parsed.issues.some((i) => i.path === "rosterRules.orc.skillStacking"),
    ).toBe(true);
  });

  it("coup de pouce absent du catalogue du moteur", () => {
    const parsed = parseDefinition(
      validInput({
        allowedInducements: [{ slug: "poudre_de_perlimpinpin", cost: 10_000 }],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0].path).toBe("allowedInducements.0.slug");
    expect(parsed.issues[0].message).toMatch(/inconnu/i);
  });

  it("coup de pouce tarifé deux fois", () => {
    const parsed = parseDefinition(
      validInput({
        allowedInducements: [
          { slug: "bribe", cost: 100_000 },
          { slug: "bribe", cost: 50_000 },
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0].path).toBe("allowedInducements.1.slug");
  });
});

describe("cohérence du barème de taxe Star Players", () => {
  it("refuse deux tranches sans borne haute", () => {
    const parsed = parseDefinition(
      validInput({
        starPlayerSppTax: [
          { maxTotalCostK: null, spp: 18 },
          { maxTotalCostK: null, spp: 24 },
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues.some((i) => /sans borne/.test(i.message))).toBe(true);
  });

  it("refuse une tranche sans borne ailleurs qu'en dernier", () => {
    const parsed = parseDefinition(
      validInput({
        starPlayerSppTax: [
          { maxTotalCostK: null, spp: 18 },
          { maxTotalCostK: 299, spp: 24 },
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0].path).toBe("starPlayerSppTax.0.maxTotalCostK");
  });

  it("refuse des tranches non croissantes", () => {
    const parsed = parseDefinition(
      validInput({
        starPlayerSppTax: [
          { maxTotalCostK: 299, spp: 18 },
          { maxTotalCostK: 199, spp: 24 },
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0].path).toBe("starPlayerSppTax.1.maxTotalCostK");
  });

  it("accepte un barème vide (aucune taxe)", () => {
    expect(parseDefinition(validInput({ starPlayerSppTax: [] })).ok).toBe(true);
  });
});

describe("valeurs par défaut", () => {
  it("descriptionFr est optionnelle", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).descriptionFr;
    const parsed = parseDefinition(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.definition.descriptionFr).toBe("");
  });

  it("regionalLeagueChoice reste absent quand non renseigné", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).regionalLeagueChoice;
    const parsed = parseDefinition(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.definition.regionalLeagueChoice).toBeUndefined();
  });
});
