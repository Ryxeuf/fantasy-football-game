import { describe, it, expect } from "vitest";
import { ALLOWED_TEAMS } from "@bb/game-engine";
import { isCompiledTeamRoster } from "./allowed-teams";

describe("allowed-teams (repli compilé)", () => {
  it("inclut bretonnian (Season 3 NAF)", () => {
    expect(ALLOWED_TEAMS).toContain("bretonnian");
    expect(isCompiledTeamRoster("bretonnian")).toBe(true);
  });

  it("rejette un slug inconnu", () => {
    expect(isCompiledTeamRoster("definitely-not-a-roster")).toBe(false);
  });
});
