/**
 * Fraîcheur du gel d'une feuille de ligue : une autre feuille d'une des deux
 * équipes validée (ou invalidée) après le gel le rend périmé ; la mise à
 * jour refuse de perdre un joueur que la saisie cite.
 */
import { describe, it, expect } from "vitest";
import {
  orphanSheetPlayers,
  referencedSheetPlayerIds,
  snapshotCapturedAt,
  snapshotPlayers,
  staleSnapshotChange,
  type OtherTeamSheet,
} from "./league-sheet-snapshot-freshness";

const T0 = Date.parse("2026-09-16T10:00:00.000Z");
const later = (minutes: number) => new Date(T0 + minutes * 60_000);

function other(over: Partial<OtherTeamSheet> = {}): OtherTeamSheet {
  return {
    pairingId: "j2",
    validatedAt: null,
    invalidatedAt: null,
    roundNumber: 2,
    roundName: null,
    homeTeamId: "paladins",
    homeTeamName: "Paladins de la Dame",
    awayTeamId: "elves",
    awayTeamName: "Elfes",
    ...over,
  };
}

describe("snapshotCapturedAt", () => {
  it("lit `capturedAt` du gel (objet natif ou chaîne)", () => {
    expect(snapshotCapturedAt({ capturedAt: T0 }, null)).toBe(T0);
    expect(snapshotCapturedAt(JSON.stringify({ capturedAt: T0 }), null)).toBe(T0);
  });

  it("un gel sans `capturedAt` se date par la création de la feuille", () => {
    expect(snapshotCapturedAt({ headerOnly: true }, later(5))).toBe(
      later(5).getTime(),
    );
  });

  it("un côté non gelé n'a pas d'instant", () => {
    expect(snapshotCapturedAt(null, later(5))).toBeNull();
    expect(snapshotCapturedAt("pas du json", later(5))).toBeNull();
  });
});

describe("staleSnapshotChange", () => {
  const base = { capturedAt: T0, teamId: "paladins", currentPairingId: "j3" };

  it("une feuille de l'équipe validée APRÈS le gel le rend périmé", () => {
    expect(
      staleSnapshotChange({ ...base, sheets: [other({ validatedAt: later(60) })] }),
    ).toEqual({
      pairingId: "j2",
      kind: "validated",
      at: later(60).toISOString(),
      roundLabel: "journée 2",
      homeTeamName: "Paladins de la Dame",
      awayTeamName: "Elfes",
    });
  });

  it("validée AVANT le gel : à jour", () => {
    expect(
      staleSnapshotChange({ ...base, sheets: [other({ validatedAt: later(-60) })] }),
    ).toBeNull();
  });

  it("une invalidation après le gel le rend aussi périmé", () => {
    const out = staleSnapshotChange({
      ...base,
      sheets: [other({ validatedAt: later(-60), invalidatedAt: later(30) })],
    });
    expect(out?.kind).toBe("invalidated");
  });

  it("invalidée puis revalidée : l'évènement le plus récent l'emporte", () => {
    const out = staleSnapshotChange({
      ...base,
      sheets: [
        other({ invalidatedAt: later(30), validatedAt: later(90) }),
        other({ pairingId: "j1", roundNumber: 1, validatedAt: later(45) }),
      ],
    });
    expect(out).toMatchObject({ pairingId: "j2", kind: "validated" });
  });

  it("ignore la feuille elle-même et celles des autres équipes", () => {
    expect(
      staleSnapshotChange({
        ...base,
        sheets: [
          other({ pairingId: "j3", validatedAt: later(60) }),
          other({
            homeTeamId: "dwarves",
            awayTeamId: "orcs",
            validatedAt: later(60),
          }),
        ],
      }),
    ).toBeNull();
  });

  it("côté non gelé : rien à signaler", () => {
    expect(
      staleSnapshotChange({
        ...base,
        capturedAt: null,
        sheets: [other({ validatedAt: later(60) })],
      }),
    ).toBeNull();
  });
});

describe("snapshotPlayers", () => {
  it("indexe les joueurs du gel qui portent un id", () => {
    const map = snapshotPlayers({
      players: [
        { id: "p1", number: 7, name: "Griff" },
        { number: 12, name: "Journalier (Trois-quart)" },
      ],
    });
    expect([...map]).toEqual([["p1", "n°7 Griff"]]);
  });
});

describe("orphanSheetPlayers", () => {
  const before = new Map([
    ["p1", "n°1 Griff"],
    ["journeyman-home-1", "n°12 Journalier"],
  ]);

  it("signale un joueur cité que le nouveau gel ne connaît plus", () => {
    expect(
      orphanSheetPlayers({
        referencedIds: ["p1", "journeyman-home-1", "p1"],
        before,
        after: new Map([["p1", "n°1 Griff"]]),
      }),
    ).toEqual([{ id: "journeyman-home-1", label: "n°12 Journalier" }]);
  });

  it("un id absent de l'ancien gel (Star Player, relevé) n'est pas concerné", () => {
    expect(
      orphanSheetPlayers({
        referencedIds: ["star-home-morg"],
        before,
        after: new Map(),
      }),
    ).toEqual([]);
  });
});

describe("referencedSheetPlayerIds", () => {
  it("rassemble évènements, JDM, licenciements, évolutions, PSP, prières et recrutements", () => {
    const ids = referencedSheetPlayerIds(
      {
        motmPlayerIds: JSON.stringify(["m1"]),
        firedPlayerIds: ["f1"],
        advancementsHome: [{ playerId: "a1" }],
        advancementsAway: "[]",
        sppBonus: [{ playerId: "b1", spp: 1 }],
        prayersHome: [{ roll: 10, playerId: "pr1" }],
        purchasesAway: [{ kind: "journeyman", journeymanId: "journeyman-away-1" }],
      },
      [{ actorPlayerId: "e1", targetPlayerId: "e2" }, { actorPlayerId: null }],
    );
    expect([...ids].sort()).toEqual(
      ["a1", "b1", "e1", "e2", "f1", "journeyman-away-1", "m1", "pr1"].sort(),
    );
  });
});
