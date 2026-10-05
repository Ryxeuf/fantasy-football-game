import { describe, it, expect } from "vitest";
import {
  adjacentRounds,
  predictionsDigest,
  rankLabel,
  roundPredictionLabel,
  roundPredictionLinks,
  roundPredictionStatus,
  roundPredictionsPagePath,
  seasonPredictionsPagePath,
} from "./prediction-rounds";
import {
  makeBoard,
  makeEntry,
  makePairing,
  makeRound,
  makeView,
} from "./predictions.fixtures";

const MINE = { pick: "home", homeScore: null, awayScore: null, grade: "pending", points: 0 } as const;

describe("roundPredictionStatus", () => {
  it("todo : compte les rencontres ouvertes au lecteur sans pronostic", () => {
    const status = roundPredictionStatus(
      makeRound({
        pairings: [
          makePairing({ id: "a" }),
          makePairing({ id: "b", myPrediction: MINE }),
          makePairing({ id: "c", eligibility: "own-match" }),
        ],
      }),
    );
    expect(status).toEqual({ state: "todo", todo: 1, predictable: 2 });
  });

  it("done : tout ce qui est ouvert au lecteur est pronostiqué", () => {
    const status = roundPredictionStatus(
      makeRound({ pairings: [makePairing({ myPrediction: MINE })] }),
    );
    expect(status?.state).toBe("done");
  });

  it("open : des rencontres ouvertes, mais pas au lecteur", () => {
    const status = roundPredictionStatus(
      makeRound({ pairings: [makePairing({ eligibility: "anonymous" })] }),
    );
    expect(status?.state).toBe("open");
  });

  it("closed : tout est clos", () => {
    const status = roundPredictionStatus(
      makeRound({
        pairings: [makePairing({ closed: true, eligibility: "closed" })],
      }),
    );
    expect(status?.state).toBe("closed");
  });

  it("ignore les affiches à venir, et rend null s'il n'y a qu'elles", () => {
    expect(
      roundPredictionStatus(
        makeRound({
          pairings: [makePairing({ placeholder: true, eligibility: "placeholder" })],
        }),
      ),
    ).toBeNull();
    expect(roundPredictionStatus(makeRound({ pairings: [] }))).toBeNull();
  });
});

describe("roundPredictionLabel", () => {
  it("annonce l'action attendue", () => {
    expect(roundPredictionLabel({ state: "todo", todo: 3, predictable: 4 })).toBe(
      "Pronostiquer (3)",
    );
    expect(roundPredictionLabel({ state: "done", todo: 0, predictable: 4 })).toBe(
      "Pronostics ✓",
    );
    expect(roundPredictionLabel({ state: "open", todo: 0, predictable: 0 })).toBe(
      "Pronostics",
    );
    expect(roundPredictionLabel({ state: "closed", todo: 0, predictable: 0 })).toBe(
      "Résultats des pronos",
    );
  });
});

describe("chemins", () => {
  it("page de saison et page de journée", () => {
    expect(seasonPredictionsPagePath("lg", "s")).toBe(
      "/leagues/lg/seasons/s/predictions",
    );
    expect(roundPredictionsPagePath("lg", "s", "r")).toBe(
      "/leagues/lg/seasons/s/predictions/r",
    );
  });
});

describe("roundPredictionLinks", () => {
  it("un lien par journée qui a des rencontres", () => {
    const links = roundPredictionLinks(
      makeView({
        rounds: [
          makeRound({ id: "r1" }),
          makeRound({ id: "r2", pairings: [] }),
        ],
      }),
      "lg-1",
    );
    expect(Object.keys(links)).toEqual(["r1"]);
    expect(links.r1).toEqual({
      href: "/leagues/lg-1/seasons/season-1/predictions/r1",
      label: "Pronostiquer (1)",
      state: "todo",
    });
  });

  it("rien quand les pronostics sont désactivés ou pas encore chargés", () => {
    expect(roundPredictionLinks(makeView({ scope: "off" }), "lg-1")).toEqual({});
    expect(roundPredictionLinks(null, "lg-1")).toEqual({});
  });
});

describe("adjacentRounds", () => {
  const rounds = [
    makeRound({ id: "r1" }),
    makeRound({ id: "r2" }),
    makeRound({ id: "r3" }),
  ];

  it("rend la journée et ses voisines", () => {
    const { previous, current, next } = adjacentRounds(rounds, "r2");
    expect([previous?.id, current?.id, next?.id]).toEqual(["r1", "r2", "r3"]);
  });

  it("bords et journée inconnue", () => {
    expect(adjacentRounds(rounds, "r1").previous).toBeNull();
    expect(adjacentRounds(rounds, "r3").next).toBeNull();
    expect(adjacentRounds(rounds, "zz")).toEqual({
      previous: null,
      current: null,
      next: null,
    });
  });
});

describe("predictionsDigest", () => {
  it("première journée à faire et place du lecteur dans son groupe", () => {
    const digest = predictionsDigest(
      makeView({
        rounds: [
          makeRound({
            id: "r1",
            pairings: [makePairing({ closed: true, eligibility: "closed" })],
          }),
          makeRound({
            id: "r2",
            roundNumber: 2,
            pairings: [makePairing({ id: "a" }), makePairing({ id: "b" })],
          }),
        ],
      }),
      makeBoard({
        coach: [
          makeEntry({ rank: 1 }),
          makeEntry({ rank: 2, userId: "u-viewer", isViewer: true, points: 14 }),
        ],
      }),
    );
    expect(digest.nextRound?.id).toBe("r2");
    expect(digest.nextRoundLabel).toBe("Journée 2");
    expect(digest.todo).toBe(2);
    expect(digest.standing?.rank).toBe(2);
  });

  it("rien à faire, pas classé", () => {
    const digest = predictionsDigest(
      makeView({
        viewer: { userId: null, isCommissioner: false, isMember: false, group: null },
        rounds: [makeRound({ pairings: [makePairing({ eligibility: "anonymous" })] })],
      }),
      null,
    );
    expect(digest.nextRound).toBeNull();
    expect(digest.todo).toBe(0);
    expect(digest.standing).toBeNull();
    expect(digest.group).toBe("coach");
  });
});

describe("rankLabel", () => {
  it("1er, puis 2e…", () => {
    expect(rankLabel(1)).toBe("1er");
    expect(rankLabel(2)).toBe("2e");
  });
});
