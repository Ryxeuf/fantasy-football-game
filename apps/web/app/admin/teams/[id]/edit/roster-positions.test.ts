/**
 * Brouillon de la liste des positions (console admin).
 */

import { describe, it, expect } from "vitest";

import {
  addPlayer,
  buildSavePayload,
  draftSignature,
  nextFreeNumber,
  removePlayer,
  toDraft,
  updatePlayer,
  validateDraft,
  type AvailablePosition,
  type DraftPlayer,
} from "./roster-positions";

const LINEMAN: AvailablePosition = {
  key: "skaven_lineman",
  name: "Coureur des rues",
  cost: 50,
  currentCount: 1,
  maxCount: 16,
  canAdd: true,
};

function draft(...players: Array<Partial<DraftPlayer>>): DraftPlayer[] {
  return players.map((p, i) => ({
    key: p.key ?? `k${i}`,
    position: p.position ?? "skaven_lineman",
    name: p.name ?? `Joueur ${i}`,
    number: p.number ?? i + 1,
    locked: p.locked ?? false,
    ...(p.id !== undefined ? { id: p.id } : { id: `p${i}` }),
  }));
}

describe("toDraft", () => {
  it("marque les joueurs morts et licenciés comme verrouillés", () => {
    const result = toDraft([
      { id: "p1", position: "lineman", name: "Vivant", number: 1 },
      { id: "p2", position: "lineman", name: "Mort", number: 2, dead: true },
      {
        id: "p3",
        position: "lineman",
        name: "Licencié",
        number: 3,
        firedAt: "2026-01-01",
      },
    ]);

    expect(result.map((p) => p.locked)).toEqual([false, true, true]);
    expect(result[0].key).toBe("p1");
  });
});

describe("nextFreeNumber", () => {
  it("prend le premier creux plutôt que le suivant du maximum", () => {
    expect(nextFreeNumber(draft({ number: 1 }, { number: 3 }))).toBe(2);
  });

  it("démarre à 1 sur un roster vide", () => {
    expect(nextFreeNumber([])).toBe(1);
  });

  it("plafonne à 99 quand tout est pris", () => {
    const full = draft(
      ...Array.from({ length: 99 }, (_, i) => ({ number: i + 1 })),
    );
    expect(nextFreeNumber(full)).toBe(99);
  });
});

describe("addPlayer", () => {
  it("ajoute un joueur SANS id (donc créé côté serveur) et le numérote", () => {
    const result = addPlayer(draft({ number: 1 }), LINEMAN);

    expect(result).toHaveLength(2);
    expect(result[1].id).toBeUndefined();
    expect(result[1].position).toBe("skaven_lineman");
    expect(result[1].number).toBe(2);
  });

  it("laisse passer un nom personnalisé", () => {
    const result = addPlayer([], LINEMAN, "Rat Bleu");
    expect(result[0].name).toBe("Rat Bleu");
  });
});

describe("removePlayer", () => {
  it("retire le joueur visé", () => {
    const players = draft({ key: "a" }, { key: "b" });
    expect(removePlayer(players, "a").map((p) => p.key)).toEqual(["b"]);
  });

  it("refuse de retirer un joueur verrouillé (mort / licencié)", () => {
    const players = draft({ key: "a", locked: true });
    expect(removePlayer(players, "a")).toHaveLength(1);
  });
});

describe("updatePlayer", () => {
  it("modifie nom et numéro sans toucher aux autres lignes", () => {
    const players = draft({ key: "a" }, { key: "b" });
    const result = updatePlayer(players, "a", { name: "Griff", number: 9 });

    expect(result[0]).toMatchObject({ name: "Griff", number: 9 });
    expect(result[1]).toEqual(players[1]);
  });
});

describe("buildSavePayload", () => {
  it("omet `id` pour les ajouts et le conserve pour les joueurs connus", () => {
    const players = [
      ...draft({ key: "a", id: "p1", name: " Rat ", number: 1 }),
      ...addPlayer([], LINEMAN),
    ];
    const payload = buildSavePayload(players, "Les Rats");

    expect(payload.name).toBe("Les Rats");
    expect(payload.players[0]).toEqual({
      id: "p1",
      position: "skaven_lineman",
      name: "Rat",
      number: 1,
    });
    expect(payload.players[1]).not.toHaveProperty("id");
  });

  it("omet le nom d'équipe quand il n'est pas fourni", () => {
    expect(buildSavePayload(draft({}))).not.toHaveProperty("name");
  });
});

describe("draftSignature", () => {
  it("est insensible à l'ordre des lignes", () => {
    const a = draft({ key: "a", id: "p1" }, { key: "b", id: "p2" });
    const b = [a[1], a[0]];
    expect(draftSignature(a, "T")).toBe(draftSignature(b, "T"));
  });

  it("change dès qu'un champ éditable change", () => {
    const a = draft({ key: "a", id: "p1", number: 1 });
    const b = updatePlayer(a, "a", { number: 2 });
    expect(draftSignature(a, "T")).not.toBe(draftSignature(b, "T"));
  });
});

describe("validateDraft", () => {
  it("accepte un brouillon sain", () => {
    expect(validateDraft(draft({ number: 1 }, { number: 2 }))).toEqual([]);
  });

  it("signale les numéros en double", () => {
    const errors = validateDraft(draft({ number: 7 }, { number: 7 }));
    expect(errors.join(" ")).toContain("7");
  });

  it("signale un nom vide", () => {
    const errors = validateDraft(draft({ name: "  " }));
    expect(errors.join(" ")).toContain("nom");
  });

  it("signale un numéro hors bornes", () => {
    const errors = validateDraft(draft({ number: 0 }));
    expect(errors.join(" ")).toContain("1 et 99");
  });

  it("refuse un roster vide", () => {
    expect(validateDraft([]).join(" ")).toContain("au moins un joueur");
  });
});
