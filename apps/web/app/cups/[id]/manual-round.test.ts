import { describe, it, expect } from "vitest";
import {
  availableTeams,
  hasDuplicateTeam,
  toManualPairingsPayload,
  type ManualPairingDraft,
} from "./manual-round";

const TEAMS = [
  { id: "t1", name: "A" },
  { id: "t2", name: "B" },
  { id: "t3", name: "C" },
];

describe("hasDuplicateTeam", () => {
  it("accepte une ronde sans doublon", () => {
    expect(
      hasDuplicateTeam([
        { homeTeamId: "t1", awayTeamId: "t2" },
        { homeTeamId: "t3", awayTeamId: null },
      ]),
    ).toBe(false);
  });

  it("repère une équipe engagée deux fois (même sur des lignes différentes)", () => {
    expect(
      hasDuplicateTeam([
        { homeTeamId: "t1", awayTeamId: "t2" },
        { homeTeamId: "t3", awayTeamId: "t1" },
      ]),
    ).toBe(true);
    expect(
      hasDuplicateTeam([{ homeTeamId: "t1", awayTeamId: "t1" }]),
    ).toBe(true);
  });

  it("ignore les cases encore vides", () => {
    expect(
      hasDuplicateTeam([
        { homeTeamId: "", awayTeamId: "" },
        { homeTeamId: "", awayTeamId: null },
      ]),
    ).toBe(false);
  });
});

describe("toManualPairingsPayload", () => {
  it("écarte les lignes sans équipe à domicile", () => {
    const drafts: ManualPairingDraft[] = [
      { homeTeamId: "", awayTeamId: "t2" },
      { homeTeamId: "t1", awayTeamId: "t2" },
    ];
    expect(toManualPairingsPayload(drafts)).toEqual([
      { homeTeamId: "t1", awayTeamId: "t2" },
    ]);
  });

  it("traduit une case extérieure vide en exempte", () => {
    expect(
      toManualPairingsPayload([
        { homeTeamId: "t1", awayTeamId: "" },
        { homeTeamId: "t2", awayTeamId: null },
      ]),
    ).toEqual([
      { homeTeamId: "t1", awayTeamId: null },
      { homeTeamId: "t2", awayTeamId: null },
    ]);
  });
});

describe("availableTeams", () => {
  it("retire les équipes déjà engagées ailleurs", () => {
    const pairings: ManualPairingDraft[] = [
      { homeTeamId: "t1", awayTeamId: "t2" },
    ];
    expect(availableTeams(TEAMS, pairings, null).map((t) => t.id)).toEqual([
      "t3",
    ]);
  });

  it("garde l'équipe déjà choisie sur la case courante", () => {
    const pairings: ManualPairingDraft[] = [
      { homeTeamId: "t1", awayTeamId: "t2" },
    ];
    expect(availableTeams(TEAMS, pairings, "t1").map((t) => t.id)).toEqual([
      "t1",
      "t3",
    ]);
  });
});
