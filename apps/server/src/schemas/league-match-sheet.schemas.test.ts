/**
 * A67/A68 — validation de `addEventSchema` : une Séquelle (stat_loss)
 * sans `meta.stat` valide était acceptée puis silencieusement droppée
 * à l'application sur le roster. Le schéma la refuse désormais.
 */

import { describe, it, expect } from "vitest";
import {
  addEventSchema,
  postMatchSchema,
  preMatchSchema,
  raiseDeadSchema,
} from "./league-match-sheet.schemas";

describe("A67/A68 — addEventSchema stat_loss", () => {
  const base = {
    kind: "casualty" as const,
    team: "home" as const,
    actorPlayerId: "h1",
    targetPlayerId: "a1",
  };

  it("refuse stat_loss sans meta.stat", () => {
    const res = addEventSchema.safeParse({
      ...base,
      injurySeverity: "stat_loss",
    });
    expect(res.success).toBe(false);
  });

  it("refuse stat_loss avec meta.stat invalide", () => {
    const res = addEventSchema.safeParse({
      ...base,
      injurySeverity: "stat_loss",
      meta: { stat: "xx" },
    });
    expect(res.success).toBe(false);
  });

  it("accepte stat_loss avec meta.stat parmi ma/st/ag/pa/av", () => {
    for (const stat of ["ma", "st", "ag", "pa", "av"]) {
      const res = addEventSchema.safeParse({
        ...base,
        injurySeverity: "stat_loss",
        meta: { stat },
      });
      expect(res.success).toBe(true);
    }
  });

  it("accepte les autres gravités sans meta", () => {
    const res = addEventSchema.safeParse({
      ...base,
      injurySeverity: "mng",
    });
    expect(res.success).toBe(true);
  });
});

describe("FDM — addEventSchema pass_complete (réceptionneur)", () => {
  const pass = {
    kind: "pass_complete" as const,
    team: "home" as const,
    actorPlayerId: "h1",
  };

  it("accepte un réceptionneur distinct du lanceur", () => {
    const res = addEventSchema.safeParse({ ...pass, targetPlayerId: "h9" });
    expect(res.success).toBe(true);
  });

  it("refuse un réceptionneur identique au lanceur", () => {
    const res = addEventSchema.safeParse({ ...pass, targetPlayerId: "h1" });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.path).toEqual(["targetPlayerId"]);
  });

  it("rétro-compat : une passe sans réceptionneur reste valide", () => {
    expect(addEventSchema.safeParse(pass).success).toBe(true);
    expect(
      addEventSchema.safeParse({ ...pass, targetPlayerId: null }).success,
    ).toBe(true);
  });

  it("n'impose rien aux autres types d'évènement", () => {
    // Une auto-élimination peut porter le même id des deux côtés.
    const res = addEventSchema.safeParse({
      kind: "other_elim",
      team: "home",
      actorPlayerId: "h1",
      targetPlayerId: "h1",
      injurySeverity: "badly_hurt",
    });
    expect(res.success).toBe(true);
  });
});

describe("Prières à Nuffle — preMatchSchema.prayers*", () => {
  it("accepte une liste de jets de D16 valides (avec ou sans prayerId)", () => {
    const res = preMatchSchema.safeParse({
      prayersHome: [
        { roll: 3, prayerId: "stiletto" },
        { roll: 16 },
      ],
      prayersAway: [],
    });
    expect(res.success).toBe(true);
  });

  it("refuse un jet hors 1-16", () => {
    for (const roll of [0, 17]) {
      const res = preMatchSchema.safeParse({ prayersHome: [{ roll }] });
      expect(res.success).toBe(false);
    }
  });

  it("refuse plus de 3 prières par équipe (coup de pouce 0-3)", () => {
    const res = preMatchSchema.safeParse({
      prayersHome: [{ roll: 1 }, { roll: 2 }, { roll: 3 }, { roll: 4 }],
    });
    expect(res.success).toBe(false);
  });

  it("refuse un doublon de jet (relancé à la table)", () => {
    const res = preMatchSchema.safeParse({
      prayersHome: [{ roll: 5 }, { roll: 5 }],
    });
    expect(res.success).toBe(false);
  });

  it("tolère null / absent (rétro-compat)", () => {
    expect(preMatchSchema.safeParse({ prayersHome: null }).success).toBe(true);
    expect(preMatchSchema.safeParse({ weather: "Pluie" }).success).toBe(true);
  });
});

describe("Toss — preMatchSchema.tossWinner/tossChoice", () => {
  it("accepte un vainqueur et un choix valides", () => {
    const res = preMatchSchema.safeParse({
      tossWinner: "home",
      tossChoice: "receive",
    });
    expect(res.success).toBe(true);
  });

  it("refuse un côté ou un choix hors enum", () => {
    expect(preMatchSchema.safeParse({ tossWinner: "middle" }).success).toBe(
      false,
    );
    expect(preMatchSchema.safeParse({ tossChoice: "flip" }).success).toBe(
      false,
    );
  });

  it("tolère null / absent (rétro-compat)", () => {
    expect(
      preMatchSchema.safeParse({ tossWinner: null, tossChoice: null }).success,
    ).toBe(true);
  });
});

describe("Maîtres de la Non-vie — raiseDeadSchema", () => {
  it("accepte un relevé avec ou sans poste, et l'annulation (victimId null)", () => {
    expect(
      raiseDeadSchema.safeParse({
        side: "home",
        victimId: "a1",
        position: "undead_trois_quart_zombie",
      }).success,
    ).toBe(true);
    expect(raiseDeadSchema.safeParse({ side: "away", victimId: "a1" }).success).toBe(
      true,
    );
    expect(
      raiseDeadSchema.safeParse({ side: "home", victimId: null }).success,
    ).toBe(true);
  });

  it("refuse un côté inconnu, une victime vide ou absente", () => {
    expect(
      raiseDeadSchema.safeParse({ side: "north", victimId: "a1" }).success,
    ).toBe(false);
    expect(raiseDeadSchema.safeParse({ side: "home", victimId: "" }).success).toBe(
      false,
    );
    expect(raiseDeadSchema.safeParse({ side: "home" }).success).toBe(false);
  });
});

describe("Maîtres de la Non-vie — achat `raised_dead`", () => {
  it("est un type d'achat d'après-match accepté", () => {
    expect(
      postMatchSchema.safeParse({
        purchasesHome: [{ kind: "raised_dead", name: "Grommit", cost: 0 }],
      }).success,
    ).toBe(true);
  });

  it("un type d'achat inconnu reste refusé", () => {
    expect(
      postMatchSchema.safeParse({
        purchasesHome: [{ kind: "necromancer", name: "x", cost: 0 }],
      }).success,
    ).toBe(false);
  });
});
