import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// Mock du client API : le composant lit /leagues/me/invitations et poste
// le refus sur /leagues/invitations/:code/decline.
vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { PendingLeagueInvitations } from "./PendingLeagueInvitations";
import { apiRequest } from "../../lib/api-client";

const mockApi = apiRequest as unknown as ReturnType<typeof vi.fn>;

const oneInvitation = {
  invitations: [
    {
      id: "inv-1",
      code: "CODE123",
      message: "Rejoins-nous",
      expiresAt: "2030-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      league: { id: "lg-1", name: "Skaven Cup" },
      season: { id: "s1", name: "S1", seasonNumber: 1, status: "draft" },
      inviter: { id: "u9", coachName: "Griff" },
      inviteeTeam: null,
    },
  ],
};

describe("PendingLeagueInvitations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders nothing when there is no invitation (showWhenEmpty=false)", async () => {
    mockApi.mockResolvedValue({ invitations: [] });
    const { container } = render(<PendingLeagueInvitations />);
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith("/leagues/me/invitations"),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("pending-league-invitations")).toBeNull(),
    );
    expect(container.textContent).toBe("");
  });

  it("lists pending invitations with accept link and decline button", async () => {
    mockApi.mockResolvedValue(oneInvitation);
    render(<PendingLeagueInvitations />);

    await waitFor(() => screen.getByTestId("pending-invitation-inv-1"));
    expect(screen.getByText("Skaven Cup")).toBeTruthy();
    // Accept = lien vers la page d'acceptation (choix d'équipe/saison là-bas).
    const acceptLink = screen.getByTestId("accept-invitation-inv-1");
    expect(acceptLink.getAttribute("href")).toBe(
      "/leagues/invitations/CODE123",
    );
    expect(screen.getByTestId("decline-invitation-inv-1")).toBeTruthy();
  });

  it("declines an invitation then reloads the list", async () => {
    // 1er appel : liste (1 invit). 2e : decline. 3e : reload (0 invit).
    mockApi
      .mockResolvedValueOnce(oneInvitation)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ invitations: [] });

    render(<PendingLeagueInvitations showWhenEmpty />);
    await waitFor(() => screen.getByTestId("decline-invitation-inv-1"));

    fireEvent.click(screen.getByTestId("decline-invitation-inv-1"));

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        "/leagues/invitations/CODE123/decline",
        { method: "POST" },
      ),
    );
    // Après reload, l'invitation disparaît.
    await waitFor(() =>
      expect(screen.queryByTestId("pending-invitation-inv-1")).toBeNull(),
    );
  });
});
