/**
 * Création d'une rencontre : avertissement NON bloquant quand les deux
 * équipes appartiennent au même coach (décision du propriétaire : permis,
 * mais visible du commissaire).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { LeagueParticipantDetail, LeagueRoundDetail } from "./types";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import { ManualScheduleEditor, isSameCoachPairing } from "./ManualScheduleEditor";

function participant(
  id: string,
  ownerId: string,
  coachName: string | null = `Coach ${ownerId}`,
): LeagueParticipantDetail {
  return {
    id,
    seasonElo: 1000,
    status: "active",
    teamId: `t-${id}`,
    team: {
      id: `t-${id}`,
      name: `Equipe ${id}`,
      roster: "human",
      owner: { id: ownerId, coachName },
    },
  };
}

const PARTICIPANTS = [
  participant("a", "o1", "Griff"),
  participant("b", "o1", "Griff"),
  participant("c", "o2"),
];

const ROUND: LeagueRoundDetail = {
  id: "r-1",
  roundNumber: 1,
  name: null,
  status: "pending",
  startDate: null,
  endDate: null,
  pairings: [],
};

function renderEditor() {
  render(
    <ManualScheduleEditor
      seasonId="s-1"
      rounds={[ROUND]}
      participants={PARTICIPANTS}
      onChanged={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByTestId("open-manual-schedule"));
}

function pick(home: string, away: string) {
  fireEvent.change(screen.getByTestId("manual-home-r-1"), {
    target: { value: home },
  });
  fireEvent.change(screen.getByTestId("manual-away-r-1"), {
    target: { value: away },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("isSameCoachPairing", () => {
  it.each([
    ["même coach", "a", "b", true],
    ["coachs différents", "a", "c", false],
    ["extérieur pas encore choisi", "a", "", false],
    ["domicile pas encore choisi", "", "b", false],
    ["même équipe (refusée ailleurs)", "a", "a", false],
    ["participant inconnu", "a", "zz", false],
  ] as const)("%s ⇒ %s", (_l, home, away, expected) => {
    expect(isSameCoachPairing(PARTICIPANTS, home, away)).toBe(expected);
  });

  it("sans propriétaire servi (API antérieure) : pas d'avertissement", () => {
    const legacy = [
      { id: "x", team: {} },
      { id: "y", team: {} },
    ];
    expect(isSameCoachPairing(legacy, "x", "y")).toBe(false);
  });
});

describe("ManualScheduleEditor — même coach", () => {
  it("avertit sans bloquer la création", async () => {
    apiRequest.mockResolvedValue({});
    renderEditor();
    pick("a", "b");

    const warning = screen.getByTestId("manual-same-coach-warning-r-1");
    expect(warning.textContent).toContain(
      "Les deux équipes appartiennent au même coach (Griff)",
    );
    const add = screen.getByTestId("manual-add-pairing-r-1") as HTMLButtonElement;
    expect(add.disabled).toBe(false);

    fireEvent.click(add);
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/leagues/rounds/r-1/pairings", {
        method: "POST",
        body: JSON.stringify({ homeParticipantId: "a", awayParticipantId: "b" }),
      }),
    );
  });

  it("aucun avertissement entre deux coachs différents", () => {
    renderEditor();
    pick("a", "c");
    expect(screen.queryByTestId("manual-same-coach-warning-r-1")).toBeNull();
  });
});
