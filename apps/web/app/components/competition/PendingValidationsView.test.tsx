import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PendingValidationsView, {
  pendingForCompetition,
  pendingRoundLabel,
  type PendingValidation,
} from "./PendingValidationsView";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

const item = (over: Partial<PendingValidation>): PendingValidation => ({
  kind: "league",
  pairingId: "p1",
  matchSheetId: "s1",
  leagueId: "L1",
  leagueName: "Ligue",
  seasonId: "S1",
  seasonName: "Saison 1",
  roundNumber: 3,
  homeTeamName: "Orcs",
  awayTeamName: "Rats",
  bothSubmittedAt: null,
  ...over,
});

const LEAGUE_ITEM = item({});
const CUP_ITEM = item({
  kind: "cup",
  pairingId: "cp1",
  leagueId: "C1",
  seasonId: "",
  seasonName: "",
  roundNumber: 2,
  homeTeamName: "Nains",
  awayTeamName: "Elfes",
});
// Même id que la coupe, mais une LIGUE : ne doit jamais remonter côté coupe.
const SAME_ID_LEAGUE = item({ pairingId: "p2", leagueId: "C1" });

describe("pendingForCompetition", () => {
  it("filtre sur la compétition ET son type", () => {
    const all = [LEAGUE_ITEM, CUP_ITEM, SAME_ID_LEAGUE];
    expect(pendingForCompetition(all, "cup", "C1")).toEqual([CUP_ITEM]);
    expect(pendingForCompetition(all, "league", "L1")).toEqual([LEAGUE_ITEM]);
  });

  it("lit une entrée sans type (serveur antérieur) comme une ligue", () => {
    const legacy = { ...LEAGUE_ITEM, kind: undefined };
    expect(pendingForCompetition([legacy], "league", "L1")).toHaveLength(1);
    expect(pendingForCompetition([legacy], "cup", "L1")).toHaveLength(0);
  });
});

describe("pendingRoundLabel", () => {
  it("parle de ronde en coupe, de journée en ligue", () => {
    expect(pendingRoundLabel(CUP_ITEM)).toBe("Ronde 2");
    expect(pendingRoundLabel(LEAGUE_ITEM)).toBe("Saison 1 — Journée 3");
  });
});

describe("PendingValidationsView", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({
      pending: [LEAGUE_ITEM, CUP_ITEM, SAME_ID_LEAGUE],
      count: 3,
    });
  });

  it("liste les feuilles de la COUPE, avec retour et feuille de coupe", async () => {
    render(<PendingValidationsView competition="cup" competitionId="C1" />);
    expect(await screen.findByTestId("pending-cp1")).toBeTruthy();
    expect(screen.queryByTestId("pending-p2")).toBeNull();
    expect(screen.getByTestId("pending-back-link").getAttribute("href")).toBe("/cups/C1");
    expect(screen.getByTestId("validate-link-cp1").getAttribute("href")).toBe(
      "/cups/pairings/cp1/sheet",
    );
    expect(screen.getByText("Ronde 2")).toBeTruthy();
  });

  it("garde la page de ligue telle quelle", async () => {
    render(<PendingValidationsView competition="league" competitionId="L1" />);
    expect(await screen.findByTestId("pending-p1")).toBeTruthy();
    expect(screen.getByTestId("pending-back-link").getAttribute("href")).toBe("/leagues/L1");
    expect(screen.getByTestId("validate-link-p1").getAttribute("href")).toBe(
      "/leagues/pairings/p1/sheet",
    );
  });
});
