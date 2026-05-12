/**
 * Tests pour MvpVoteSection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { MvpVoteSection } from "./MvpVoteSection";

const originalFetch = global.fetch;

const candidateFixture = {
  rosterId: "p1",
  name: "Grott Steelfist",
  position: "Lineman",
  teamSlug: "tA",
  teamName: "Athletics",
  sppGained: 9,
  tdCount: 1,
  casCount: 2,
  mvpCount: 1,
};

const candidate2 = {
  ...candidateFixture,
  rosterId: "p2",
  name: "Sven Brave",
  sppGained: 5,
  tdCount: 0,
  casCount: 1,
  mvpCount: 0,
};

const tallyFixture = (closeInFuture: boolean) => ({
  matchId: "m1",
  totalVotes: 3,
  entries: [
    { rosterId: "p1", count: 2 },
    { rosterId: "p2", count: 1 },
  ],
  winnerRosterId: "p1",
  windowClosesAt: closeInFuture
    ? new Date(Date.now() + 60_000).toISOString()
    : new Date(Date.now() - 60_000).toISOString(),
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => "dummy-token",
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function chain(candidates: any[], tally: any) {
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ candidates }),
  } as unknown as Response);
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => tally,
  } as unknown as Response);
  return fetchMock;
}

describe("MvpVoteSection", () => {
  it("affiche les candidats triés et le total de votes", async () => {
    global.fetch = chain(
      [candidateFixture, candidate2],
      tallyFixture(true),
    ) as unknown as typeof fetch;

    render(<MvpVoteSection matchId="m1" />);

    await waitFor(() => {
      expect(screen.getByTestId("mvp-section")).toBeTruthy();
    });
    expect(screen.getByTestId("mvp-candidate-p1")).toBeTruthy();
    expect(screen.getByTestId("mvp-candidate-p2")).toBeTruthy();
    expect(screen.getByTestId("mvp-count-p1").textContent).toBe("2");
    expect(screen.getByTestId("mvp-total-votes").textContent).toMatch(/3 votes/);
  });

  it("affiche le badge MVP sur le winner", async () => {
    global.fetch = chain(
      [candidateFixture, candidate2],
      tallyFixture(true),
    ) as unknown as typeof fetch;

    render(<MvpVoteSection matchId="m1" />);

    await waitFor(() => {
      expect(screen.getByTestId("mvp-candidate-p1")).toBeTruthy();
    });
    expect(screen.getByTestId("mvp-candidate-p1").textContent).toMatch(/MVP/);
    expect(screen.getByTestId("mvp-candidate-p2").textContent).not.toMatch(
      /⭐ MVP/,
    );
  });

  it("désactive les boutons quand window fermée", async () => {
    global.fetch = chain(
      [candidateFixture],
      tallyFixture(false),
    ) as unknown as typeof fetch;

    render(<MvpVoteSection matchId="m1" />);

    await waitFor(() => {
      expect(screen.getByTestId("mvp-vote-p1")).toBeTruthy();
    });
    const btn = screen.getByTestId("mvp-vote-p1") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTestId("mvp-total-votes").textContent).toMatch(/ferme/);
  });

  it("vote → appelle POST + reload", async () => {
    const fetchMock = chain([candidateFixture], tallyFixture(true));
    // POST vote
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ voteId: "v1", isUpdate: false }),
    } as unknown as Response);
    // Reload : candidates + tally
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [candidateFixture] }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...tallyFixture(true),
        totalVotes: 4,
        entries: [{ rosterId: "p1", count: 4 }],
      }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MvpVoteSection matchId="m1" />);
    await waitFor(() => screen.getByTestId("mvp-vote-p1"));
    fireEvent.click(screen.getByTestId("mvp-vote-p1"));

    await waitFor(() => {
      expect(screen.getByTestId("mvp-submit-message")).toBeTruthy();
    });
    const voteCall = fetchMock.mock.calls[2];
    expect(voteCall[0]).toMatch(/\/mvp-vote/);
    expect(JSON.parse(voteCall[1].body as string)).toEqual({
      votedRosterId: "p1",
    });
  });

  it("erreur affichee si vote échoue (409)", async () => {
    const fetchMock = chain([candidateFixture], tallyFixture(true));
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Fenetre fermee" }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MvpVoteSection matchId="m1" />);
    await waitFor(() => screen.getByTestId("mvp-vote-p1"));
    fireEvent.click(screen.getByTestId("mvp-vote-p1"));

    await waitFor(() => {
      expect(screen.getByTestId("mvp-submit-error")).toBeTruthy();
    });
    expect(screen.getByTestId("mvp-submit-error").textContent).toMatch(
      /Fenetre fermee/,
    );
  });

  it("message empty si aucun candidat", async () => {
    global.fetch = chain([], {
      matchId: "m1",
      totalVotes: 0,
      entries: [],
      winnerRosterId: null,
      windowClosesAt: null,
    }) as unknown as typeof fetch;

    render(<MvpVoteSection matchId="m1" />);
    await waitFor(() => {
      expect(screen.getByTestId("mvp-empty")).toBeTruthy();
    });
  });

  it("erreur affichée si le fetch initial échoue", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Match introuvable" }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<MvpVoteSection matchId="m1" />);
    await waitFor(() => {
      expect(screen.getByTestId("mvp-error")).toBeTruthy();
    });
  });
});
