import { describe, expect, it } from "vitest";
import { rosterPdfTrackingCells } from "./roster-pdf-cells";

const career = {
  matchesPlayed: 5,
  touchdowns: 3,
  casualties: 2,
  completions: 0,
  interceptions: 1,
  mvpAwards: 1,
  spp: 8,
};

describe("rosterPdfTrackingCells", () => {
  it("français : PSP, RPM, BP — RC reste à remplir", () => {
    expect(
      rosterPdfTrackingCells({ missNextMatch: true, nigglingInjuries: 2 }, career, "fr"),
    ).toEqual(["8", "X", "2", ""]);
    expect(rosterPdfTrackingCells({}, { ...career, spp: 0 }, "fr")).toEqual([
      "0",
      "",
      "",
      "",
    ]);
  });

  it("anglais : SPP puis la carrière toutes compétitions (TD, CAS, INT)", () => {
    expect(rosterPdfTrackingCells({}, career, "en")).toEqual(["8", "3", "2", "1"]);
    expect(
      rosterPdfTrackingCells(
        {},
        { ...career, touchdowns: 0, casualties: 0, interceptions: 0 },
        "en",
      ),
    ).toEqual(["8", "", "", ""]);
  });
});
