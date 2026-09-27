import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "lg-1", sid: "season-1" }),
}));

const apiRequest = vi.fn();
vi.mock("../../../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import SeasonRecapPage from "./page";
import { LanguageProvider } from "../../../../../contexts/LanguageContext";

function renderRecap() {
  return render(
    <LanguageProvider>
      <SeasonRecapPage />
    </LanguageProvider>,
  );
}

const EMPTY_AWARDS = {
  topScorer: [],
  bestDefense: [],
  basher: [],
  martyrs: [],
  cleanestSheet: [],
  mostWins: [],
};

function recap(awards: Record<string, unknown>) {
  return {
    seasonId: "season-1",
    championUserId: null,
    championTeamId: null,
    championLabel: null,
    awards,
    standings: [],
    persistedAt: null,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SeasonRecapPage — Oracle de la saison", () => {
  it("affiche l'Oracle, ses points en valeur", async () => {
    apiRequest.mockResolvedValue(
      recap({
        ...EMPTY_AWARDS,
        oracle: [
          {
            teamId: "t1",
            teamName: "Les Voyants",
            roster: "human",
            ownerId: "u1",
            coachName: "Cassandre",
            value: 17,
          },
        ],
      }),
    );
    renderRecap();
    await waitFor(() => {
      expect(screen.getByTestId("award-card-oracle")).toBeTruthy();
    });
    const card = screen.getByTestId("award-card-oracle");
    expect(card.textContent).toContain("Les Voyants");
    expect(card.textContent).toContain("Cassandre");
    expect(card.textContent).toContain("17");
  });

  it("masque la carte sans Oracle (ligue sans pronostics, serveur antérieur)", async () => {
    apiRequest.mockResolvedValue(recap({ ...EMPTY_AWARDS }));
    renderRecap();
    await waitFor(() => {
      expect(screen.getByTestId("season-recap-awards-grid")).toBeTruthy();
    });
    expect(screen.queryByTestId("award-card-oracle")).toBeNull();
    // Les autres cartes gardent leur mention « vide ».
    expect(screen.getByTestId("award-card-topScorer")).toBeTruthy();
  });
});
