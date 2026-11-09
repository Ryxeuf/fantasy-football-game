/**
 * Retrait d'une équipe en cours de saison par le commissaire : action
 * proposée seulement saison lancée, choix forfait / annulation transmis au
 * serveur, résultat résumé.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { SeasonParticipants } from "./SeasonParticipants";
import { describeWithdrawOutcome } from "./CommissionerWithdrawControl";
import type { LeagueParticipantDetail } from "./types";

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
      name: `Équipe ${over.id}`,
      roster: "humans",
      owner: { id: `${over.id}-owner`, coachName: null },
    },
    ...over,
  };
}

function renderList(props: Partial<Parameters<typeof SeasonParticipants>[0]>) {
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("describeWithdrawOutcome", () => {
  it("résume forfaits, annulations et places de play-off à réattribuer", () => {
    expect(
      describeWithdrawOutcome({
        forfeited: ["a", "b"],
        cancelled: ["c"],
        placeholders: ["d"],
      }),
    ).toMatch(/2 rencontre\(s\) perdue\(s\) par forfait, 1 rencontre\(s\) annulée\(s\), 1 place\(s\) de play-off/);
    expect(describeWithdrawOutcome({})).toMatch(/aucune rencontre restante/);
  });
});

describe("SeasonParticipants — retrait en cours de saison", () => {
  it("absent avant le démarrage (la suppression suffit) et pour un coach", () => {
    renderList({ commissionerLeagueId: "L1", seasonId: "S1", seasonStatus: "scheduled" });
    expect(screen.queryByTestId("withdraw-team-p1")).toBeNull();
  });

  it("absent hors contexte commissaire", () => {
    renderList({ seasonId: "S1", seasonStatus: "in_progress" });
    expect(screen.queryByTestId("withdraw-team-p1")).toBeNull();
  });

  it("absent pour une équipe déjà retirée", () => {
    render(
      <LanguageProvider>
        <SeasonParticipants
          participants={[participant({ id: "p1", status: "withdrawn" })]}
          commissionerLeagueId="L1"
          seasonId="S1"
          seasonStatus="in_progress"
        />
      </LanguageProvider>,
    );
    expect(screen.queryByTestId("withdraw-team-p1")).toBeNull();
  });

  it("le commissaire choisit l'annulation et confirme", async () => {
    apiRequestMock.mockResolvedValue({ forfeited: [], cancelled: ["x", "y"] });
    const { onChanged } = renderList({
      commissionerLeagueId: "L1",
      seasonId: "S1",
      seasonStatus: "in_progress",
    });

    fireEvent.click(screen.getByTestId("withdraw-team-p1"));
    fireEvent.click(screen.getByTestId("withdraw-policy-cancel-p1"));
    fireEvent.click(screen.getByTestId("withdraw-confirm-p1"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/seasons/S1/participants/p1/withdraw",
        { method: "POST", body: JSON.stringify({ remaining: "cancel" }) },
      ),
    );
    expect(
      (await screen.findByTestId("withdraw-result-p1")).textContent,
    ).toMatch(/2 rencontre\(s\) annulée\(s\)/);
    expect(onChanged).toHaveBeenCalled();
  });

  it("forfait par défaut, refus du serveur affiché", async () => {
    apiRequestMock.mockRejectedValue(new Error("Feuille soumise"));
    renderList({ commissionerLeagueId: "L1", seasonId: "S1", seasonStatus: "in_progress" });
    fireEvent.click(screen.getByTestId("withdraw-team-p1"));
    fireEvent.click(screen.getByTestId("withdraw-confirm-p1"));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/seasons/S1/participants/p1/withdraw",
        { method: "POST", body: JSON.stringify({ remaining: "forfeit" }) },
      ),
    );
    expect((await screen.findByTestId("withdraw-error-p1")).textContent).toBe(
      "Feuille soumise",
    );
  });
});
