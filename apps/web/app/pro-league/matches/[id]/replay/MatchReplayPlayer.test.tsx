/**
 * Sprint 1.G.2 — Tests `<MatchReplayPlayer>`.
 *
 * Mocke `apiRequest` pour fournir un dump synthetique et `ProLeagueField`
 * pour eviter de charger Pixi en jsdom.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

import type { MatchEvent } from "@bb/shared-types";

vi.mock("../../../../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

// Stub le ProLeagueField (chargee via next/dynamic) pour eviter Pixi.
vi.mock("../live/ProLeagueField", () => ({
  default: () => <div data-testid="field-stub" />,
}));

// Stub next/dynamic pour reexporter direct le module (evite le wrapping
// async qui ne resout pas en jsdom).
vi.mock("next/dynamic", () => ({
  default: () => {
    return function DynamicStub() {
      return <div data-testid="field-stub" />;
    };
  },
}));

import { apiRequest } from "../../../../lib/api-client";
import MatchReplayPlayer from "./MatchReplayPlayer";

const mockedRequest = vi.mocked(apiRequest);

const FIXTURE_EVENTS: MatchEvent[] = [
  {
    type: "KICKOFF",
    displayAtMs: 0,
    engineVer: "0.13.0",
    meta: { home: "home", away: "away", weather: "nice" },
  },
  {
    type: "TURN_START",
    displayAtMs: 30_000,
    engineVer: "0.13.0",
    meta: { half: 1, turn: 1, drivingTeam: "away", ballYardline: 4 },
  },
  {
    type: "TD",
    displayAtMs: 90_000,
    engineVer: "0.13.0",
    meta: { team: "away", scoreAfter: { home: 0, away: 1 } },
  },
  {
    type: "HALFTIME",
    displayAtMs: 240_000,
    engineVer: "0.13.0",
    meta: { score: { home: 0, away: 1 } },
  },
  {
    type: "TD",
    displayAtMs: 480_000,
    engineVer: "0.13.0",
    meta: { team: "home", scoreAfter: { home: 1, away: 1 } },
  },
  {
    type: "END",
    displayAtMs: 600_000,
    engineVer: "0.13.0",
    meta: { score: { home: 1, away: 1 } },
  },
];

const FIXTURE_DUMP = {
  matchId: "m1",
  status: "completed",
  durationMs: 600_000,
  eventCount: FIXTURE_EVENTS.length,
  events: FIXTURE_EVENTS,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<MatchReplayPlayer> — sprint 1.G.2", () => {
  it("affiche un loading initial", () => {
    mockedRequest.mockReturnValue(new Promise(() => {})); // never resolve
    render(<MatchReplayPlayer matchId="m1" />);
    expect(screen.getByTestId("replay-loading")).toBeTruthy();
  });

  it("affiche une erreur si la fetch echoue", async () => {
    mockedRequest.mockRejectedValue(new Error("server down"));
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("replay-error").textContent).toContain(
      "server down",
    );
  });

  it("rend score 0-0 au mount (currentMs=0, avant les TDs)", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("replay-score").textContent).toContain("0 – 0");
    expect(screen.getByTestId("replay-half").textContent).toContain("1st half");
  });

  it("affiche durationMs format MM:SS dans le scrubber", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("replay-duration").textContent).toBe("10:00");
    expect(screen.getByTestId("replay-current-time").textContent).toBe("00:00");
  });

  it("seek via scrub bar update score si TD passe", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    const scrub = screen.getByTestId("replay-scrub") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(scrub, { target: { value: "120000" } });
    });
    // 120s > TD #1 (90s) -> 0-1
    expect(screen.getByTestId("replay-score").textContent).toContain("0 – 1");
  });

  it("skip-to-end affiche le score final + half=FT", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("replay-skip-end"));
    });
    expect(screen.getByTestId("replay-score").textContent).toContain("1 – 1");
    expect(screen.getByTestId("replay-half").textContent).toContain("FT");
    expect(screen.getByTestId("replay-current-time").textContent).toBe("10:00");
  });

  it("toggle play/pause met aria-pressed sur le bouton", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    const toggle = screen.getByTestId("replay-toggle");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("speed selector marque la vitesse active", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      screen.getByTestId("replay-speed-1").getAttribute("aria-pressed"),
    ).toBe("true");
    await act(async () => {
      fireEvent.click(screen.getByTestId("replay-speed-4"));
    });
    expect(
      screen.getByTestId("replay-speed-4").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByTestId("replay-speed-1").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("event feed contient kickoff visible meme a currentMs=0", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    const feed = screen.getByTestId("replay-event-feed");
    expect(feed.textContent).toContain("KICKOFF");
  });

  it("event feed reverse-chronologique apres skip-to-end", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("replay-skip-end"));
    });
    const feed = screen.getByTestId("replay-event-feed");
    const items = feed.querySelectorAll("li");
    // Le 1er item de la liste = dernier event (END), le dernier item = KICKOFF.
    expect(items[0].textContent).toContain("END");
    expect(items[items.length - 1].textContent).toContain("KICKOFF");
  });

  it("affiche les markers TD pour chaque touchdown du replay", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    const tdMarkers = screen.queryAllByTestId("scrub-marker-td");
    // FIXTURE_EVENTS contient 2 TDs.
    expect(tdMarkers).toHaveLength(2);
  });

  it("click sur un marker TD seek vers son displayAtMs", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    const tdMarkers = screen.getAllByTestId("scrub-marker-td");
    // Premier TD = displayAtMs 90_000 (1:30). Avant click, currentMs=0 -> score 0-0.
    expect(screen.getByTestId("replay-score").textContent).toContain("0 – 0");
    await act(async () => {
      fireEvent.click(tdMarkers[0]);
    });
    // Apres seek a 90s, le 1er TD est inclus -> score 0-1.
    expect(screen.getByTestId("replay-score").textContent).toContain("0 – 1");
  });

  it("expose un title (tooltip) sur chaque marker", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    const tdMarkers = screen.getAllByTestId("scrub-marker-td");
    // Chaque title contient "TOUCHDOWN" + team.
    expect(tdMarkers[0].getAttribute("title")).toMatch(/TOUCHDOWN/);
  });

  it("affiche le hint des raccourcis clavier", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      screen.getByTestId("replay-shortcuts-hint").textContent,
    ).toMatch(/Espace/);
  });

  it("Space keypress toggle play/pause", async () => {
    mockedRequest.mockResolvedValue(FIXTURE_DUMP);
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    const toggle = screen.getByTestId("replay-toggle");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", cancelable: true }),
      );
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("ne rend pas de markers si le replay n'a aucun key moment", async () => {
    mockedRequest.mockResolvedValue({
      ...FIXTURE_DUMP,
      events: [
        {
          type: "KICKOFF",
          displayAtMs: 0,
          engineVer: "0.13.0",
          meta: {},
        } as never,
        {
          type: "TURN_START",
          displayAtMs: 30_000,
          engineVer: "0.13.0",
          meta: { half: 1, turn: 1, drivingTeam: "home", ballYardline: 4 },
        } as never,
        {
          type: "END",
          displayAtMs: 600_000,
          engineVer: "0.13.0",
          meta: { score: { home: 0, away: 0 } },
        } as never,
      ],
    });
    render(<MatchReplayPlayer matchId="m1" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("scrub-markers")).toBeNull();
  });
});
