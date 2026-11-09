/**
 * Remplacement d'un qualifié dans une rencontre de bracket NON jouée, même
 * quand d'autres rencontres le sont (retour testeur : finale à 2, le 2e
 * quitte la ligue, impossible de mettre le 3e).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlayoffBracketView } from "./PlayoffBracketView";
import { replacementCandidates } from "./playoff-bracket-edit";

const apiRequestMock = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

function team(id: string, name: string) {
  return { id, name, roster: "human", owner: { id: `u-${id}`, coachName: name } };
}
function participant(id: string, name: string) {
  return { id, team: team(`t-${id}`, name) };
}

const A = participant("a", "Alpha");
const B = participant("b", "Bravo");
const C = participant("c", "Charlie");
const D = participant("d", "Delta");

/** Demis jouées (a bat b, c bat d), finale a vs c à jouer. */
function playedSemis() {
  return {
    seasonId: "S1",
    playoffSize: 4,
    seasonStatus: "in_progress",
    playoffsPublished: true,
    rounds: [
      {
        id: "r-sf1",
        roundNumber: 5,
        bracketSlot: "sf1",
        status: "completed",
        pairings: [
          { id: "sf1", status: "played", match: null, homeParticipant: A, awayParticipant: B },
        ],
      },
      {
        id: "r-sf2",
        roundNumber: 6,
        bracketSlot: "sf2",
        status: "completed",
        pairings: [
          { id: "sf2", status: "played", match: null, homeParticipant: C, awayParticipant: D },
        ],
      },
      {
        id: "r-final",
        roundNumber: 7,
        bracketSlot: "final",
        status: "pending",
        pairings: [
          { id: "final", status: "scheduled", match: null, matchSheet: null, homeParticipant: A, awayParticipant: C },
        ],
      },
    ],
  };
}

const ELIGIBLE = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Bravo" },
  { id: "d", name: "Delta" },
  { id: "e", name: "Echo" },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("replacementCandidates (pur)", () => {
  const rounds = playedSemis().rounds;
  const final = rounds[2].pairings[0];

  it("exclut l'adversaire et le remplacé, garde les éliminés", () => {
    expect(
      replacementCandidates(rounds, final, "away", ELIGIBLE).map((c) => c.id),
    ).toEqual(["b", "d", "e"]);
  });

  it("placeholder : remplace le qualifié connu", () => {
    const ph = { ...final, awayParticipant: A };
    expect(
      replacementCandidates(rounds, ph, "away", ELIGIBLE).map((c) => c.id),
    ).toEqual(["b", "d", "e"]);
  });

  it("exclut une équipe engagée dans une autre rencontre à jouer", () => {
    const open = [
      { pairings: [{ id: "sf1", status: "scheduled", match: null, homeParticipant: A, awayParticipant: B }] },
      { pairings: [{ id: "sf2", status: "scheduled", match: null, homeParticipant: C, awayParticipant: D }] },
    ];
    expect(
      replacementCandidates(open, open[1].pairings[0], "away", ELIGIBLE).map(
        (c) => c.id,
      ),
    ).toEqual(["e"]);
  });
});

describe("PlayoffBracketView — remplacer un qualifié", () => {
  it("le commissaire remplace un finaliste alors que les demies sont jouées", async () => {
    apiRequestMock.mockResolvedValueOnce(playedSemis());
    apiRequestMock.mockResolvedValueOnce({ pairingId: "final" });
    apiRequestMock.mockResolvedValue(playedSemis());
    render(
      <PlayoffBracketView
        seasonId="S1"
        isCommissioner
        eligibleParticipants={ELIGIBLE}
      />,
    );

    // Seule la finale (à jouer) propose l'action.
    fireEvent.click(await screen.findByTestId("playoff-replace-final"));
    expect(screen.queryByTestId("playoff-replace-sf1")).toBeNull();
    // L'éditeur complet n'est plus proposé : des rencontres sont jouées.
    expect(screen.queryByTestId("playoff-edit-participants")).toBeNull();

    fireEvent.click(screen.getByTestId("playoff-replace-side-away"));
    fireEvent.change(screen.getByTestId("playoff-replace-select-final"), {
      target: { value: "d" },
    });
    fireEvent.click(screen.getByTestId("playoff-replace-submit-final"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/pairings/final/playoff-participant",
        {
          method: "PATCH",
          body: JSON.stringify({ side: "away", participantId: "d" }),
        },
      ),
    );
  });

  it("un coach ne voit pas l'action", async () => {
    apiRequestMock.mockResolvedValue(playedSemis());
    render(<PlayoffBracketView seasonId="S1" />);
    expect(await screen.findByTestId("playoff-bracket")).toBeTruthy();
    expect(screen.queryByTestId("playoff-replace-final")).toBeNull();
  });

  it("pas d'action sur une rencontre dont la feuille est soumise", async () => {
    const base = playedSemis();
    const data = {
      ...base,
      rounds: base.rounds.map((r) =>
        r.id === "r-final"
          ? {
              ...r,
              pairings: r.pairings.map((p) => ({
                ...p,
                matchSheet: { status: "submitted_home" },
              })),
            }
          : r,
      ),
    };
    apiRequestMock.mockResolvedValue(data);
    render(
      <PlayoffBracketView seasonId="S1" isCommissioner eligibleParticipants={ELIGIBLE} />,
    );
    expect(await screen.findByTestId("playoff-bracket")).toBeTruthy();
    expect(screen.queryByTestId("playoff-replace-final")).toBeNull();
  });
});
