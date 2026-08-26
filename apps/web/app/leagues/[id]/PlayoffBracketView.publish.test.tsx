/**
 * Publication du bracket de playoffs.
 *
 * Le bracket est généré automatiquement à la clôture de la phase
 * régulière, mais reste invisible aux coachs tant que le commissaire ne
 * l'a pas publié — l'API leur sert alors `rounds: []`, ce qui rend le
 * composant vide, exactement comme « pas encore de playoffs ».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlayoffBracketView } from "./PlayoffBracketView";

const apiRequestMock = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

function team(id: string, name: string) {
  return {
    id,
    name,
    roster: "human",
    owner: { id: `u-${id}`, coachName: name },
  };
}

function bracketResponse(over: Record<string, unknown> = {}) {
  return {
    seasonId: "S1",
    playoffSize: 2,
    seasonStatus: "in_progress",
    playoffsPublished: true,
    regularSeasonComplete: true,
    rounds: [
      {
        id: "r-final",
        roundNumber: 1,
        bracketSlot: "final",
        status: "pending",
        pairings: [
          {
            id: "p1",
            status: "scheduled",
            match: null,
            homeParticipant: { id: "pa1", team: team("t1", "Reikland") },
            awayParticipant: { id: "pa2", team: team("t2", "Gouged Eye") },
          },
        ],
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PlayoffBracketView — publication", () => {
  it("un coach ne voit rien tant que le bracket n'est pas publié", async () => {
    // L'API sert un bracket VIDE aux coachs quand il n'est pas publié.
    apiRequestMock.mockResolvedValue(
      bracketResponse({ playoffsPublished: false, rounds: [] }),
    );
    render(<PlayoffBracketView seasonId="S1" />);
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalled());
    expect(screen.queryByTestId("playoff-bracket")).toBeNull();
    expect(screen.queryByTestId("playoff-publish")).toBeNull();
  });

  it("le commissaire voit le bracket non publié + le bouton de publication", async () => {
    apiRequestMock.mockResolvedValue(
      bracketResponse({ playoffsPublished: false }),
    );
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);

    expect(await screen.findByTestId("playoff-bracket")).toBeTruthy();
    expect(screen.getByTestId("playoff-publish-state").textContent).toMatch(
      /non publié/i,
    );
    expect(screen.getByTestId("playoff-publish-toggle").textContent).toMatch(
      /publier les playoffs/i,
    );
  });

  it("publie via PATCH puis recharge", async () => {
    apiRequestMock.mockResolvedValue(
      bracketResponse({ playoffsPublished: false }),
    );
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);
    await screen.findByTestId("playoff-publish-toggle");

    fireEvent.click(screen.getByTestId("playoff-publish-toggle"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/seasons/S1/playoff-bracket/publish",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ published: true }),
        }),
      ),
    );
  });

  it("propose de dépublier quand le bracket est publié", async () => {
    apiRequestMock.mockResolvedValue(bracketResponse());
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);

    expect(
      (await screen.findByTestId("playoff-publish-state")).textContent,
    ).toMatch(/publié/i);
    expect(screen.getByTestId("playoff-publish-toggle").textContent).toMatch(
      /dépublier/i,
    );
  });

  it("API antérieure (pas de champ) : bracket considéré publié", async () => {
    const res = bracketResponse();
    delete (res as Record<string, unknown>).playoffsPublished;
    apiRequestMock.mockResolvedValue(res);
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);

    expect(
      (await screen.findByTestId("playoff-publish-toggle")).textContent,
    ).toMatch(/dépublier/i);
  });
});
