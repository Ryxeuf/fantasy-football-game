import { describe, it, expect } from "vitest";
import { ALLOWED_TEAMS } from "@bb/game-engine";
import { isAllowedTeamRoster } from "./allowed-teams";

describe("allowed-teams", () => {
  it("inclut bretonnian (Season 3 NAF)", () => {
    expect(ALLOWED_TEAMS).toContain("bretonnian");
    expect(isAllowedTeamRoster("bretonnian")).toBe(true);
  });

  it("rejette un slug inconnu", () => {
    expect(isAllowedTeamRoster("definitely-not-a-roster")).toBe(false);
  });
});
