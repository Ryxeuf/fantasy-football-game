/**
 * Sprint Pro League lot 1.B.4 — Tests page live ticker.
 *
 * Mocke le hook `useProLeagueMatchStream` pour contrôler les events.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import type { MatchEvent } from "@bb/shared-types";

vi.mock("../../../../lib/use-pro-league-match-stream", () => ({
  useProLeagueMatchStream: vi.fn(),
}));

import { useProLeagueMatchStream } from "../../../../lib/use-pro-league-match-stream";
import LiveProMatchPage from "./page";

const mockedHook = vi.mocked(useProLeagueMatchStream);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LiveProMatchPage — sprint 1.B.4", () => {
  it("affiche '0 – 0' + 'En attente du kickoff' quand pas d'events", () => {
    mockedHook.mockReturnValue({
      events: [],
      connectionState: "connecting",
      error: null,
    });

    render(<LiveProMatchPage params={{ id: "m1" }} />);

    expect(screen.getByTestId("score-display").textContent).toContain("0");
    expect(screen.getByText(/En attente/i)).toBeTruthy();
    expect(screen.getByTestId("connection-badge").textContent).toMatch(
      /connecting/i,
    );
  });

  it("affiche le badge LIVE quand connecté", () => {
    mockedHook.mockReturnValue({
      events: [],
      connectionState: "open",
      error: null,
    });
    render(<LiveProMatchPage params={{ id: "m1" }} />);
    expect(screen.getByTestId("connection-badge").textContent).toMatch(/LIVE/);
  });

  it("calcule le score à partir des events TD", () => {
    const events: MatchEvent[] = [
      {
        type: "KICKOFF",
        displayAtMs: 0,
        engineVer: "0.13.0",
        seed: 1,
        meta: { home: "h", away: "a" },
      },
      {
        type: "TD",
        displayAtMs: 30_000,
        engineVer: "0.13.0",
        meta: { team: "home" },
      },
      {
        type: "TD",
        displayAtMs: 60_000,
        engineVer: "0.13.0",
        meta: { team: "home" },
      },
      {
        type: "TD",
        displayAtMs: 90_000,
        engineVer: "0.13.0",
        meta: { team: "away" },
      },
    ];
    mockedHook.mockReturnValue({
      events,
      connectionState: "open",
      error: null,
    });
    render(<LiveProMatchPage params={{ id: "m1" }} />);
    expect(screen.getByTestId("score-display").textContent).toContain("2");
    expect(screen.getByTestId("score-display").textContent).toContain("1");
  });

  it("affiche '2nd half' après HALFTIME et 'FT' après END", () => {
    const events: MatchEvent[] = [
      {
        type: "KICKOFF",
        displayAtMs: 0,
        engineVer: "0.13.0",
        seed: 1,
        meta: {},
      },
      {
        type: "HALFTIME",
        displayAtMs: 240_000,
        engineVer: "0.13.0",
        meta: { score: { home: 1, away: 1 } },
      },
    ];
    mockedHook.mockReturnValueOnce({
      events,
      connectionState: "open",
      error: null,
    });
    const { rerender } = render(<LiveProMatchPage params={{ id: "m1" }} />);
    expect(screen.getByText(/2nd half/i)).toBeTruthy();

    mockedHook.mockReturnValue({
      events: [
        ...events,
        {
          type: "END",
          displayAtMs: 480_000,
          engineVer: "0.13.0",
          meta: { score: { home: 2, away: 1 } },
        },
      ],
      connectionState: "closed",
      error: null,
    });
    rerender(<LiveProMatchPage params={{ id: "m1" }} />);
    expect(screen.getByText("FT")).toBeTruthy();
  });

  it("liste les events avec les badges et l'horloge", () => {
    const events: MatchEvent[] = [
      {
        type: "TD",
        displayAtMs: 75_000,
        engineVer: "0.13.0",
        meta: { team: "home" },
      },
    ];
    mockedHook.mockReturnValue({
      events,
      connectionState: "open",
      error: null,
    });
    render(<LiveProMatchPage params={{ id: "m1" }} />);
    expect(screen.getByText("TD")).toBeTruthy();
    expect(screen.getByText("1:15")).toBeTruthy();
    expect(screen.getByText(/TOUCHDOWN HOME/i)).toBeTruthy();
  });

  it("ordre inverse : event le plus récent en haut", () => {
    const events: MatchEvent[] = [
      {
        type: "KICKOFF",
        displayAtMs: 0,
        engineVer: "0.13.0",
        seed: 1,
        meta: {},
      },
      {
        type: "TD",
        displayAtMs: 30_000,
        engineVer: "0.13.0",
        meta: { team: "home" },
      },
    ];
    mockedHook.mockReturnValue({
      events,
      connectionState: "open",
      error: null,
    });
    render(<LiveProMatchPage params={{ id: "m1" }} />);
    const items = screen.getByTestId("event-feed").querySelectorAll("li");
    expect(items.length).toBe(2);
    // Premier li = event le plus récent (TD).
    expect(items[0].textContent).toContain("TD");
    expect(items[1].textContent).toContain("KICKOFF");
  });

  it("affiche le message d'erreur si error retourné par le hook", () => {
    mockedHook.mockReturnValue({
      events: [],
      connectionState: "error",
      error: "boom-parse",
    });
    render(<LiveProMatchPage params={{ id: "m1" }} />);
    expect(screen.getByRole("alert").textContent).toContain("boom-parse");
  });
});
