/**
 * Moteur pur d'appariement en ronde suisse : ordre du classement, zéro
 * rematch (avec retour arrière), exempt tournant, domicile équilibré.
 */
import { describe, it, expect } from "vitest";
import { generateSwissRound, pickBye } from "./swiss-pairing";

const standings = (ids: string[]) => ids.map((teamId) => ({ teamId }));
const noHistory = { playedPairs: [], byes: [] };

function key(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

describe("generateSwissRound", () => {
  it("apparie 1-2, 3-4 en première ronde, tables numérotées", () => {
    const out = generateSwissRound(standings(["t1", "t2", "t3", "t4"]), noHistory);
    expect(out.bye).toBeNull();
    expect(out.rematchForced).toBe(false);
    expect(out.pairings.map((p) => [p.home, p.away, p.table])).toEqual([
      ["t1", "t2", 1],
      ["t3", "t4", 2],
    ]);
  });

  it("est déterministe", () => {
    const a = generateSwissRound(standings(["a", "b", "c", "d", "e", "f"]), noHistory);
    const b = generateSwissRound(standings(["a", "b", "c", "d", "e", "f"]), noHistory);
    expect(a).toEqual(b);
  });

  it("exempte la dernière équipe du classement, puis fait tourner l'exempt", () => {
    const r1 = generateSwissRound(standings(["t1", "t2", "t3", "t4", "t5"]), noHistory);
    expect(r1.bye).toBe("t5");
    expect(r1.pairings).toHaveLength(2);
    const r2 = generateSwissRound(standings(["t1", "t2", "t3", "t4", "t5"]), {
      playedPairs: [],
      byes: ["t5"],
    });
    expect(r2.bye).toBe("t4");
    // Toutes déjà exemptées : la dernière l'est de nouveau.
    expect(pickBye(["t1", "t2", "t3"], ["t1", "t2", "t3"])).toBe("t3");
  });

  it("évite les rematches : l'adversaire le plus proche pas encore rencontré", () => {
    const out = generateSwissRound(standings(["t1", "t2", "t3", "t4"]), {
      playedPairs: [["t2", "t1"], ["t3", "t4"]],
      byes: [],
    });
    const pairs = out.pairings.map((p) => key(p.home, p.away)).sort();
    expect(pairs).toEqual(["t1|t3", "t2|t4"]);
    expect(out.rematchForced).toBe(false);
  });

  it("revient en arrière quand le choix au plus proche mène à une impasse", () => {
    // 1 ne peut pas jouer 2 ; 4, 5 et 6 se sont tous rencontrés. Le glouton
    // (1-3, 2-4, 5-6) échoue : seule la solution 1-4, 2-5, 3-6 est sans rematch.
    const out = generateSwissRound(standings(["1", "2", "3", "4", "5", "6"]), {
      playedPairs: [["1", "2"], ["4", "5"], ["4", "6"], ["5", "6"]],
      byes: [],
    });
    const played = new Set([key("1", "2"), key("4", "5"), key("4", "6"), key("5", "6")]);
    for (const p of out.pairings) {
      expect(played.has(key(p.home, p.away))).toBe(false);
    }
    expect(out.rematchForced).toBe(false);
    expect(out.pairings).toHaveLength(3);
  });

  it("accepte un rematch quand aucune alternative n'existe", () => {
    const out = generateSwissRound(standings(["t1", "t2"]), {
      playedPairs: [["t1", "t2"]],
      byes: [],
    });
    expect(out.pairings).toHaveLength(1);
    expect(out.rematchForced).toBe(true);
  });

  it("donne le domicile à l'équipe qui a le moins reçu, sinon au mieux classé", () => {
    const out = generateSwissRound(standings(["t1", "t2", "t3", "t4"]), {
      playedPairs: [],
      byes: [],
      homeCounts: { t1: 2, t2: 0, t3: 1, t4: 1 },
    });
    expect(out.pairings[0]).toMatchObject({ home: "t2", away: "t1" });
    expect(out.pairings[1]).toMatchObject({ home: "t3", away: "t4" });
  });

  it("apparie un grand tournoi sans rematch après plusieurs rondes", () => {
    const ids = Array.from({ length: 24 }, (_, i) => `e${i + 1}`);
    const playedPairs: Array<[string, string]> = [];
    const byes: string[] = [];
    for (let round = 0; round < 5; round += 1) {
      // Le classement bouge un peu à chaque ronde (rotation) pour forcer
      // des appariements différents.
      const rotated = ids.slice(round).concat(ids.slice(0, round));
      const out = generateSwissRound(standings(rotated), { playedPairs, byes });
      expect(out.rematchForced).toBe(false);
      expect(out.pairings).toHaveLength(12);
      for (const p of out.pairings) playedPairs.push([p.home, p.away]);
    }
    expect(new Set(playedPairs.map(([a, b]) => key(a, b))).size).toBe(60);
  });

  it("refuse moins de deux équipes ou des doublons", () => {
    expect(() => generateSwissRound(standings(["t1"]), noHistory)).toThrow(/deux/);
    expect(() => generateSwissRound(standings(["t1", "t1"]), noHistory)).toThrow(/unique/);
  });
});
