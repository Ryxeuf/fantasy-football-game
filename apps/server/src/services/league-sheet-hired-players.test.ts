import { describe, it, expect } from "vitest";
import {
  hiredSheetPlayerIdsFromOfflineSnapshot,
  resolveHiredSheetPlayerId,
} from "./league-sheet-hired-players";

function snapshot(over: {
  purchasesHome?: unknown;
  purchasesAway?: unknown;
  home?: unknown;
  away?: unknown;
}) {
  return {
    input: {
      purchasesHome: over.purchasesHome ?? [],
      purchasesAway: over.purchasesAway ?? [],
    },
    rosterMutations: {
      home: over.home ?? { createdPlayerIds: [] },
      away: over.away ?? { createdPlayerIds: [] },
    },
  };
}

describe("hiredSheetPlayerIdsFromOfflineSnapshot", () => {
  it("relie un journalier recruté au TeamPlayer créé", () => {
    const map = hiredSheetPlayerIdsFromOfflineSnapshot(
      snapshot({
        purchasesHome: [
          { kind: "journeyman", name: "Fresno", cost: 50000, journeymanId: "journeyman-home-1" },
        ],
        home: { createdPlayerIds: ["tp-fresno"] },
      }),
    );
    expect([...map]).toEqual([["journeyman-home-1", "tp-fresno"]]);
  });

  it("aligne dans l'ordre des achats créateurs, staff et relances ignorés", () => {
    const map = hiredSheetPlayerIdsFromOfflineSnapshot(
      snapshot({
        purchasesHome: [
          { kind: "reroll", name: "Relance", cost: 60000 },
          { kind: "player", name: "Neuf", cost: 50000 },
          { kind: "staff", name: "Apothicaire", cost: 50000 },
          { kind: "journeyman", name: "J2", cost: 50000, journeymanId: "journeyman-home-2" },
        ],
        home: { createdPlayerIds: ["tp-neuf", "tp-j2"] },
        purchasesAway: [
          { kind: "raised_dead", name: "Zombie", cost: 0, journeymanId: "raised-away-1" },
        ],
        away: { createdPlayerIds: ["tp-zombie"] },
      }),
    );
    expect(map.get("journeyman-home-2")).toBe("tp-j2");
    expect(map.get("raised-away-1")).toBe("tp-zombie");
    expect(map.size).toBe(2);
  });

  it("ne devine pas quand un achat créateur a été sauté (liste à 16)", () => {
    const map = hiredSheetPlayerIdsFromOfflineSnapshot(
      snapshot({
        purchasesHome: [
          { kind: "player", name: "Neuf", cost: 50000 },
          { kind: "journeyman", name: "J1", cost: 50000, journeymanId: "journeyman-home-1" },
        ],
        home: { createdPlayerIds: ["tp-seul"] },
      }),
    );
    expect(map.size).toBe(0);
  });

  it("lit un snapshot sérialisé (miroir SQLite) et tolère l'absence de trace", () => {
    const raw = JSON.stringify(
      snapshot({
        purchasesAway: [
          { kind: "journeyman", name: "J1", cost: 50000, journeymanId: "journeyman-away-1" },
        ],
        away: { createdPlayerIds: ["tp-j1"] },
      }),
    );
    expect(hiredSheetPlayerIdsFromOfflineSnapshot(raw).get("journeyman-away-1")).toBe("tp-j1");
    expect(hiredSheetPlayerIdsFromOfflineSnapshot(null).size).toBe(0);
    expect(hiredSheetPlayerIdsFromOfflineSnapshot("{oops").size).toBe(0);
    expect(
      hiredSheetPlayerIdsFromOfflineSnapshot({ input: { purchasesHome: [] } }).size,
    ).toBe(0);
  });
});

describe("resolveHiredSheetPlayerId", () => {
  it("crédite le recruté, laisse les autres ids tels quels", () => {
    const hired = new Map([["journeyman-home-1", "tp-fresno"]]);
    expect(resolveHiredSheetPlayerId("journeyman-home-1", hired)).toBe("tp-fresno");
    expect(resolveHiredSheetPlayerId("p1", hired)).toBe("p1");
    expect(resolveHiredSheetPlayerId(null, hired)).toBeNull();
    expect(resolveHiredSheetPlayerId("p1", undefined)).toBe("p1");
  });
});
