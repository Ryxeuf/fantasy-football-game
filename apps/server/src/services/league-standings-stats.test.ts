import { describe, it, expect } from "vitest";
import {
  foldSeasonExtraStats,
  EMPTY_EXTRA_STATS,
  TRACKED_EVENT_KINDS,
  type StandingsEventCount,
  type StandingsPairingRow,
} from "./league-standings-stats";

// F1 — pliage pur des stats etendues du classement (For / P / Agr / SP /
// Exclu). Aucun Prisma : uniquement la logique d'attribution par cote.

function pairing(
  over: Partial<StandingsPairingRow> = {},
): StandingsPairingRow {
  return {
    status: "played",
    homeParticipantId: "home-1",
    awayParticipantId: "away-1",
    matchSheetId: "sheet-1",
    ...over,
  };
}

function count(
  over: Partial<StandingsEventCount> & { kind: string },
): StandingsEventCount {
  return {
    matchSheetId: "sheet-1",
    team: "home",
    count: 1,
    ...over,
  };
}

describe("foldSeasonExtraStats — comptage par kind", () => {
  it("attribue passes / agressions / sorties public / exclusions au bon côté", () => {
    const result = foldSeasonExtraStats(
      [pairing()],
      [
        count({ kind: "pass_complete", team: "home", count: 4 }),
        count({ kind: "aggression", team: "home", count: 2 }),
        count({ kind: "crowd_surge", team: "away", count: 1 }),
        count({ kind: "expulsion", team: "away", count: 3 }),
      ],
    );

    expect(result.get("home-1")).toEqual({
      forfeits: 0,
      passes: 4,
      aggressions: 2,
      crowdSurges: 0,
      expulsions: 0,
    });
    expect(result.get("away-1")).toEqual({
      forfeits: 0,
      passes: 0,
      aggressions: 0,
      crowdSurges: 1,
      expulsions: 3,
    });
  });

  it("cumule les events de plusieurs feuilles pour un même participant", () => {
    const result = foldSeasonExtraStats(
      [
        pairing({ matchSheetId: "sheet-1" }),
        pairing({
          matchSheetId: "sheet-2",
          homeParticipantId: "away-1",
          awayParticipantId: "home-1",
        }),
      ],
      [
        count({ matchSheetId: "sheet-1", kind: "pass_complete", count: 2 }),
        count({
          matchSheetId: "sheet-2",
          kind: "pass_complete",
          team: "away",
          count: 5,
        }),
      ],
    );

    expect(result.get("home-1")?.passes).toBe(7);
    expect(result.get("away-1")?.passes).toBe(0);
  });

  it("ignore les kinds non suivis (touchdown, casualty, stalling…)", () => {
    const result = foldSeasonExtraStats(
      [pairing()],
      [
        count({ kind: "touchdown", count: 3 }),
        count({ kind: "casualty", count: 2 }),
        count({ kind: "stalling", count: 1 }),
        count({ kind: "other_elim", count: 1 }),
      ],
    );
    expect(result.get("home-1")).toEqual(EMPTY_EXTRA_STATS);
  });

  it("ignore un event sans côté ou rattaché à une feuille inconnue", () => {
    const result = foldSeasonExtraStats(
      [pairing()],
      [
        count({ kind: "pass_complete", team: null, count: 9 }),
        count({ kind: "pass_complete", team: "spectator", count: 9 }),
        count({ kind: "pass_complete", matchSheetId: "sheet-zz", count: 9 }),
      ],
    );
    expect(result.get("home-1")?.passes).toBe(0);
  });

  it("ignore un compte non fini ou négatif", () => {
    const result = foldSeasonExtraStats(
      [pairing()],
      [
        count({ kind: "pass_complete", count: Number.NaN }),
        count({ kind: "aggression", count: -3 }),
      ],
    );
    expect(result.get("home-1")).toEqual(EMPTY_EXTRA_STATS);
  });
});

describe("foldSeasonExtraStats — forfaits", () => {
  it("compte le forfait côté domicile pour le participant domicile", () => {
    const result = foldSeasonExtraStats(
      [pairing({ status: "forfeit_home", matchSheetId: null })],
      [],
    );
    expect(result.get("home-1")?.forfeits).toBe(1);
    expect(result.get("away-1")?.forfeits).toBe(0);
  });

  it("compte le forfait côté visiteur pour le participant visiteur", () => {
    const result = foldSeasonExtraStats(
      [pairing({ status: "forfeit_away", matchSheetId: null })],
      [],
    );
    expect(result.get("away-1")?.forfeits).toBe(1);
    expect(result.get("home-1")?.forfeits).toBe(0);
  });

  it("cumule plusieurs forfaits sur la saison", () => {
    const result = foldSeasonExtraStats(
      [
        pairing({ status: "forfeit_home", matchSheetId: null }),
        pairing({
          status: "forfeit_away",
          awayParticipantId: "home-1",
          homeParticipantId: "away-1",
          matchSheetId: null,
        }),
      ],
      [],
    );
    expect(result.get("home-1")?.forfeits).toBe(2);
  });

  it("n'incrémente rien pour les autres statuts de pairing", () => {
    const result = foldSeasonExtraStats(
      [
        pairing({ status: "scheduled", matchSheetId: null }),
        pairing({ status: "cancelled", matchSheetId: null }),
        pairing({ status: "in_progress", matchSheetId: null }),
      ],
      [],
    );
    expect(result.get("home-1")?.forfeits).toBe(0);
    expect(result.get("away-1")?.forfeits).toBe(0);
  });
});

describe("foldSeasonExtraStats — entrées par défaut", () => {
  it("crée une entrée à zéro pour tout participant vu dans un pairing", () => {
    const result = foldSeasonExtraStats([pairing()], []);
    expect(result.get("home-1")).toEqual(EMPTY_EXTRA_STATS);
    expect(result.get("away-1")).toEqual(EMPTY_EXTRA_STATS);
  });

  it("retourne une map vide sans pairing", () => {
    expect(foldSeasonExtraStats([], []).size).toBe(0);
  });
});

describe("TRACKED_EVENT_KINDS", () => {
  it("liste exactement les 4 kinds exposés au classement", () => {
    expect([...TRACKED_EVENT_KINDS].sort()).toEqual([
      "aggression",
      "crowd_surge",
      "expulsion",
      "pass_complete",
    ]);
  });
});
