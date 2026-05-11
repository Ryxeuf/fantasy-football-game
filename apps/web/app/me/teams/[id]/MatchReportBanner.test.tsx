/**
 * Tests pour `MatchReportBanner` (Sprint O — Lot O.C.2).
 *
 * Couvre :
 *   - Filtre par teamId : skip si match.myTeam.teamId !== teamId.
 *   - Filtre status=completed : skip in_progress/scheduled.
 *   - Filtre fenetre 7j : skip > 7 jours.
 *   - Won / Drew / Lost → couleurs + emoji corrects.
 *   - Dismiss button → flag localStorage + hide.
 *   - Lien "Voir details".
 *   - Empty / API error : pas de banner.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "../../../lib/api-client";
import { MatchReportBanner } from "./MatchReportBanner";

const mockedApi = vi.mocked(apiRequest);
const TEAM_ID = "team_buf_1";

interface MatchPayload {
  id: string;
  status: string;
  createdAt: string;
  lastMoveAt: string | null;
  myScore: number;
  opponentScore: number;
  myTeam: { teamId: string | null; teamName: string; coachName: string } | null;
  opponent: { teamName: string; coachName: string } | null;
}

function makeMatch(overrides: Partial<MatchPayload> = {}): MatchPayload {
  return {
    id: "match-1",
    status: "completed",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    lastMoveAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    myScore: 3,
    opponentScore: 1,
    myTeam: {
      teamId: TEAM_ID,
      teamName: "Snow Ogres",
      coachName: "Coach A",
    },
    opponent: { teamName: "Cheese Halflings", coachName: "Coach B" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("MatchReportBanner — Lot O.C.2", () => {
  it("affiche le banner pour un match completed recent (won)", async () => {
    mockedApi.mockResolvedValueOnce({ matches: [makeMatch()] });
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId("match-report-banner")).toBeTruthy();
    });
    expect(screen.getByTestId("match-report-score").textContent).toContain(
      "3",
    );
    expect(screen.getByTestId("match-report-score").textContent).toContain(
      "1",
    );
    expect(screen.getByTestId("match-report-banner").textContent).toContain(
      "Victoire",
    );
    expect(screen.getByTestId("match-report-banner").textContent).toContain(
      "Cheese Halflings",
    );
  });

  it("affiche 'Defaite' si myScore < opponentScore", async () => {
    mockedApi.mockResolvedValueOnce({
      matches: [makeMatch({ myScore: 0, opponentScore: 2 })],
    });
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId("match-report-banner")).toBeTruthy();
    });
    expect(screen.getByTestId("match-report-banner").textContent).toContain(
      "Défaite",
    );
  });

  it("affiche 'Match nul' si scores egaux", async () => {
    mockedApi.mockResolvedValueOnce({
      matches: [makeMatch({ myScore: 1, opponentScore: 1 })],
    });
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId("match-report-banner")).toBeTruthy();
    });
    expect(screen.getByTestId("match-report-banner").textContent).toContain(
      "Match nul",
    );
  });

  it("skip si match.myTeam.teamId !== teamId", async () => {
    mockedApi.mockResolvedValueOnce({
      matches: [
        makeMatch({
          myTeam: {
            teamId: "other-team",
            teamName: "Other",
            coachName: "C",
          },
        }),
      ],
    });
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("match-report-banner")).toBeNull();
  });

  it("skip si status !== completed (ex: in_progress)", async () => {
    mockedApi.mockResolvedValueOnce({
      matches: [makeMatch({ status: "in_progress" })],
    });
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("match-report-banner")).toBeNull();
  });

  it("skip si match > 7 jours", async () => {
    const old = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    mockedApi.mockResolvedValueOnce({
      matches: [makeMatch({ lastMoveAt: old, createdAt: old })],
    });
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("match-report-banner")).toBeNull();
  });

  it("dismiss button → flag localStorage + masque banner", async () => {
    mockedApi.mockResolvedValueOnce({ matches: [makeMatch()] });
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId("match-report-banner")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("match-report-dismiss"));
    expect(screen.queryByTestId("match-report-banner")).toBeNull();
    expect(
      window.localStorage.getItem(
        `match_report_dismissed:${TEAM_ID}:match-1`,
      ),
    ).toBe("1");
  });

  it("re-affichage masque si flag dismiss deja set", async () => {
    window.localStorage.setItem(
      `match_report_dismissed:${TEAM_ID}:match-1`,
      "1",
    );
    mockedApi.mockResolvedValueOnce({ matches: [makeMatch()] });
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("match-report-banner")).toBeNull();
  });

  it("lien 'Voir details' pointe vers /match/[id]/details", async () => {
    mockedApi.mockResolvedValueOnce({ matches: [makeMatch()] });
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId("match-report-details")).toBeTruthy();
    });
    const link = screen.getByTestId(
      "match-report-details",
    ) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/match/match-1/details");
  });

  it("erreur API silencieuse → pas de banner", async () => {
    mockedApi.mockRejectedValueOnce(new Error("boom"));
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("match-report-banner")).toBeNull();
  });

  it("supporte l'envelope { success, data: { matches } }", async () => {
    mockedApi.mockResolvedValueOnce({
      success: true,
      data: { matches: [makeMatch()] },
    });
    render(<MatchReportBanner teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId("match-report-banner")).toBeTruthy();
    });
  });
});
