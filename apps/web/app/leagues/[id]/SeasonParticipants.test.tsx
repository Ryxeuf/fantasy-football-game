import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { SeasonParticipants } from "./SeasonParticipants";
import type { LeagueParticipantDetail } from "./types";

// Suppression d'équipe par le commissaire avant le démarrage de la saison.

const apiRequestMock = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

function participant(
  over: Partial<LeagueParticipantDetail> & { id: string },
): LeagueParticipantDetail {
  return {
    seasonElo: 1000,
    status: "active",
    teamId: `${over.id}-team`,
    team: {
      id: `${over.id}-team`,
      name: over.id,
      roster: "humans",
      owner: { id: `${over.id}-owner`, coachName: null },
    },
    ...over,
  };
}

function renderParticipants(
  props: Partial<Parameters<typeof SeasonParticipants>[0]> = {},
) {
  const onChanged = vi.fn();
  render(
    <LanguageProvider>
      <SeasonParticipants
        participants={[participant({ id: "p1" })]}
        onChanged={onChanged}
        {...props}
      />
    </LanguageProvider>,
  );
  return { onChanged };
}

describe("SeasonParticipants — suppression d'équipe (commissaire)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("n'affiche pas le bouton supprimer sans contexte commissaire", () => {
    renderParticipants({ seasonId: "S1", seasonStatus: "draft" });
    expect(screen.queryByTestId("remove-team-p1-team")).toBeNull();
  });

  it("affiche le bouton supprimer pour le commissaire avant le démarrage", () => {
    renderParticipants({
      commissionerLeagueId: "L1",
      seasonId: "S1",
      seasonStatus: "scheduled",
    });
    expect(screen.getByTestId("remove-team-p1-team")).toBeTruthy();
  });

  it("masque le bouton supprimer une fois la saison démarrée", () => {
    renderParticipants({
      commissionerLeagueId: "L1",
      seasonId: "S1",
      seasonStatus: "in_progress",
    });
    expect(screen.queryByTestId("remove-team-p1-team")).toBeNull();
    // L'édition reste possible.
    expect(screen.getByTestId("edit-team-p1-team")).toBeTruthy();
  });

  it("demande confirmation puis appelle l'API DELETE et rappelle onChanged", async () => {
    apiRequestMock.mockResolvedValue({ removed: true, teamId: "p1-team" });
    const { onChanged } = renderParticipants({
      commissionerLeagueId: "L1",
      seasonId: "S1",
      seasonStatus: "draft",
    });

    fireEvent.click(screen.getByTestId("remove-team-p1-team"));
    // Étape de confirmation.
    fireEvent.click(screen.getByTestId("confirm-remove-team-p1-team"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/leagues/L1/seasons/S1/teams/p1-team",
      { method: "DELETE" },
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("affiche l'erreur renvoyée par l'API", async () => {
    apiRequestMock.mockRejectedValue(
      new Error("l'équipe a déjà participé à un match"),
    );
    renderParticipants({
      commissionerLeagueId: "L1",
      seasonId: "S1",
      seasonStatus: "draft",
    });

    fireEvent.click(screen.getByTestId("remove-team-p1-team"));
    fireEvent.click(screen.getByTestId("confirm-remove-team-p1-team"));

    await waitFor(() =>
      expect(
        screen.getByTestId("participant-remove-error").textContent,
      ).toContain("déjà participé"),
    );
  });

  it("retire un coach via l'API DELETE coaches/:coachUserId", async () => {
    apiRequestMock.mockResolvedValue({
      removed: true,
      coachUserId: "p1-owner",
      removedTeamIds: ["p1-team"],
      cancelledInvitations: 0,
    });
    const { onChanged } = renderParticipants({
      commissionerLeagueId: "L1",
      seasonId: "S1",
      seasonStatus: "draft",
    });

    fireEvent.click(screen.getByTestId("remove-coach-p1-owner"));
    fireEvent.click(screen.getByTestId("confirm-remove-coach-p1-owner"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/leagues/L1/seasons/S1/coaches/p1-owner",
      { method: "DELETE" },
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("masque le retrait de coach une fois la saison démarrée", () => {
    renderParticipants({
      commissionerLeagueId: "L1",
      seasonId: "S1",
      seasonStatus: "in_progress",
    });
    expect(screen.queryByTestId("remove-coach-p1-owner")).toBeNull();
  });
});
