import { describe, it, expect } from "vitest";
import {
  ANONYMOUS_PREDICTOR,
  PREDICTION_POINTS,
  computePredictionLeaderboard,
  gradePrediction,
  isPlaceholderPairing,
  isPredictionClosed,
  isTerminalPairingStatus,
  leaderboardLeaders,
  outcomeOf,
  parsePredictionScope,
  pickDistribution,
  predictionClosesAt,
  predictionEligibility,
  predictionGroupOf,
  predictorDisplayName,
  validatePredictionInput,
  type GradablePrediction,
  type LeaderboardPrediction,
  type PredictionEligibilityInput,
} from "./league-predictions-rules";

const NOW = new Date("2026-10-01T12:00:00Z");
const PAST = new Date("2026-09-30T12:00:00Z");
const FUTURE = new Date("2026-10-02T12:00:00Z");

describe("parsePredictionScope", () => {
  it("lit les trois portées connues", () => {
    expect(parsePredictionScope("off")).toBe("off");
    expect(parsePredictionScope("members")).toBe("members");
    expect(parsePredictionScope("open")).toBe("open");
  });

  it("coupe les pronostics d'une ligue antérieure (null) ou illisible", () => {
    expect(parsePredictionScope(null)).toBe("off");
    expect(parsePredictionScope(undefined)).toBe("off");
    expect(parsePredictionScope("everyone")).toBe("off");
    expect(parsePredictionScope(3)).toBe("off");
  });
});

describe("validatePredictionInput", () => {
  it("accepte un vainqueur seul", () => {
    expect(validatePredictionInput({ pick: "draw" })).toEqual({
      ok: true,
      value: { pick: "draw", homeScore: null, awayScore: null },
    });
  });

  it("accepte un score cohérent avec le vainqueur", () => {
    expect(
      validatePredictionInput({ pick: "home", homeScore: 2, awayScore: 1 }),
    ).toEqual({ ok: true, value: { pick: "home", homeScore: 2, awayScore: 1 } });
    expect(
      validatePredictionInput({ pick: "draw", homeScore: 1, awayScore: 1 }),
    ).toMatchObject({ ok: true });
  });

  it("refuse un vainqueur inconnu", () => {
    expect(validatePredictionInput({ pick: "home-win" })).toEqual({
      ok: false,
      error: "invalid_pick",
    });
  });

  it("refuse un score donné d'un seul côté", () => {
    expect(
      validatePredictionInput({ pick: "home", homeScore: 2, awayScore: null }),
    ).toEqual({ ok: false, error: "partial_score" });
  });

  it("refuse un score négatif, décimal ou démesuré", () => {
    for (const [home, away] of [
      [-1, 0],
      [1.5, 0],
      [31, 0],
    ]) {
      expect(
        validatePredictionInput({ pick: "home", homeScore: home, awayScore: away }),
      ).toEqual({ ok: false, error: "invalid_score" });
    }
  });

  it("refuse un score qui désigne un autre vainqueur", () => {
    expect(
      validatePredictionInput({ pick: "away", homeScore: 2, awayScore: 1 }),
    ).toEqual({ ok: false, error: "score_pick_mismatch" });
    expect(
      validatePredictionInput({ pick: "home", homeScore: 1, awayScore: 1 }),
    ).toEqual({ ok: false, error: "score_pick_mismatch" });
  });
});

describe("outcomeOf", () => {
  it("désigne domicile, nul ou extérieur", () => {
    expect(outcomeOf(2, 0)).toBe("home");
    expect(outcomeOf(1, 1)).toBe("draw");
    expect(outcomeOf(0, 3)).toBe("away");
  });
});

function prediction(
  overrides: Partial<GradablePrediction> = {},
): GradablePrediction {
  return {
    pick: "home",
    homeScore: null,
    awayScore: null,
    result: "home",
    resultHomeScore: 2,
    resultAwayScore: 0,
    ...overrides,
  };
}

describe("gradePrediction", () => {
  it("un bon vainqueur vaut 3 points", () => {
    expect(gradePrediction(prediction(), "played")).toEqual({
      grade: "outcome",
      points: PREDICTION_POINTS.outcome,
    });
  });

  it("un bon nul vaut autant qu'une bonne victoire", () => {
    expect(
      gradePrediction(
        prediction({ pick: "draw", result: "draw", resultHomeScore: 1, resultAwayScore: 1 }),
        "played",
      ),
    ).toEqual({ grade: "outcome", points: 3 });
  });

  it("le score exact ajoute 2 points", () => {
    expect(
      gradePrediction(prediction({ homeScore: 2, awayScore: 0 }), "played"),
    ).toEqual({ grade: "exact", points: 5 });
  });

  it("un bon vainqueur au score faux reste à 3", () => {
    expect(
      gradePrediction(prediction({ homeScore: 3, awayScore: 1 }), "played"),
    ).toEqual({ grade: "outcome", points: 3 });
  });

  it("un mauvais vainqueur ne rapporte rien", () => {
    expect(gradePrediction(prediction({ pick: "away" }), "played")).toEqual({
      grade: "wrong",
      points: 0,
    });
  });

  it("forfaits et annulations sortent du classement, sans rien écrire", () => {
    for (const status of ["forfeit_home", "forfeit_away", "cancelled"]) {
      expect(gradePrediction(prediction(), status)).toEqual({
        grade: "void",
        points: 0,
      });
    }
  });

  it("un forfait en ligne réglé `void` ne compte pas", () => {
    expect(gradePrediction(prediction({ result: "void" }), "played")).toEqual({
      grade: "void",
      points: 0,
    });
  });

  it("le statut fait foi : un résultat resté sur une rencontre ré-ouverte ne compte pas", () => {
    expect(gradePrediction(prediction(), "scheduled")).toEqual({
      grade: "pending",
      points: 0,
    });
  });

  it("une rencontre jouée sans règlement reste en attente", () => {
    expect(gradePrediction(prediction({ result: null }), "played")).toEqual({
      grade: "pending",
      points: 0,
    });
  });
});

describe("isTerminalPairingStatus", () => {
  it("reconnaît les rencontres tranchées", () => {
    expect(isTerminalPairingStatus("played")).toBe(true);
    expect(isTerminalPairingStatus("forfeit_away")).toBe(true);
    expect(isTerminalPairingStatus("cancelled")).toBe(true);
    expect(isTerminalPairingStatus("scheduled")).toBe(false);
    expect(isTerminalPairingStatus("in_progress")).toBe(false);
  });
});

describe("isPredictionClosed", () => {
  const open = {
    status: "scheduled",
    predictionsClosedAt: null,
    scheduledAt: null,
  };

  it("reste ouverte sans aucun signal", () => {
    expect(isPredictionClosed(open, NOW)).toBe(false);
  });

  it("ferme une rencontre tranchée", () => {
    expect(isPredictionClosed({ ...open, status: "played" }, NOW)).toBe(true);
    expect(isPredictionClosed({ ...open, status: "cancelled" }, NOW)).toBe(true);
  });

  it("ferme dès que la clôture est posée, même avec une date future", () => {
    expect(
      isPredictionClosed(
        { ...open, predictionsClosedAt: PAST, scheduledAt: FUTURE },
        NOW,
      ),
    ).toBe(true);
  });

  it("suit la date prévue, et donc son report", () => {
    expect(isPredictionClosed({ ...open, scheduledAt: PAST }, NOW)).toBe(true);
    expect(isPredictionClosed({ ...open, scheduledAt: FUTURE }, NOW)).toBe(false);
  });

  it("ferme une journée de play-off non publiée et une ligue archivée", () => {
    expect(isPredictionClosed({ ...open, hiddenPlayoff: true }, NOW)).toBe(true);
    expect(isPredictionClosed({ ...open, leagueArchived: true }, NOW)).toBe(true);
  });
});

describe("predictionClosesAt", () => {
  it("annonce la clôture posée avant la date prévue", () => {
    expect(
      predictionClosesAt({ predictionsClosedAt: PAST, scheduledAt: FUTURE }),
    ).toBe(PAST);
    expect(
      predictionClosesAt({ predictionsClosedAt: null, scheduledAt: FUTURE }),
    ).toBe(FUTURE);
    expect(
      predictionClosesAt({ predictionsClosedAt: null, scheduledAt: null }),
    ).toBeNull();
  });
});

describe("isPlaceholderPairing", () => {
  it("reconnaît le placeholder de bracket (même participant des deux côtés)", () => {
    expect(isPlaceholderPairing("p1", "p1")).toBe(true);
    expect(isPlaceholderPairing("p1", "p2")).toBe(false);
  });
});

describe("predictionEligibility", () => {
  const base: PredictionEligibilityInput = {
    scope: "members",
    viewerId: "u1",
    isMember: true,
    ownsPairingTeam: false,
    placeholder: false,
    closed: false,
  };

  it("laisse pronostiquer un membre sur la rencontre des autres", () => {
    expect(predictionEligibility(base)).toBe("ok");
  });

  it("annonce d'abord des pronostics désactivés", () => {
    expect(
      predictionEligibility({ ...base, scope: "off", viewerId: null, closed: true }),
    ).toBe("predictions-off");
  });

  it("demande un compte", () => {
    expect(predictionEligibility({ ...base, viewerId: null })).toBe("anonymous");
  });

  it("réserve la portée `members` aux membres", () => {
    expect(predictionEligibility({ ...base, isMember: false })).toBe(
      "not-member",
    );
  });

  it("ouvre la portée `open` à tout compte qui voit la ligue", () => {
    expect(
      predictionEligibility({ ...base, scope: "open", isMember: false }),
    ).toBe("ok");
  });

  it("interdit sa propre rencontre, même en portée ouverte", () => {
    expect(
      predictionEligibility({ ...base, scope: "open", ownsPairingTeam: true }),
    ).toBe("own-match");
  });

  it("refuse un placeholder de bracket puis une rencontre fermée", () => {
    expect(predictionEligibility({ ...base, placeholder: true })).toBe(
      "placeholder",
    );
    expect(predictionEligibility({ ...base, closed: true })).toBe("closed");
  });
});

describe("predictorDisplayName", () => {
  const base = {
    coachName: "Grim",
    privateProfile: true,
    isLeagueMember: false,
    isViewer: false,
  };

  it("anonymise un spectateur au profil privé", () => {
    expect(predictorDisplayName(base)).toBe(ANONYMOUS_PREDICTOR);
  });

  it("nomme un membre de la ligue, déjà nommé sur la fiche", () => {
    expect(predictorDisplayName({ ...base, isLeagueMember: true })).toBe("Grim");
  });

  it("se nomme toujours pour soi-même", () => {
    expect(predictorDisplayName({ ...base, isViewer: true })).toBe("Grim");
  });

  it("nomme un profil public, et se replie sur l'anonymat sans nom", () => {
    expect(predictorDisplayName({ ...base, privateProfile: false })).toBe("Grim");
    expect(
      predictorDisplayName({ ...base, privateProfile: false, coachName: "  " }),
    ).toBe(ANONYMOUS_PREDICTOR);
  });
});

describe("pickDistribution", () => {
  it("compte les choix d'une rencontre fermée", () => {
    expect(pickDistribution(["home", "home", "away", "draw", "bogus"])).toEqual({
      home: 2,
      draw: 1,
      away: 1,
      total: 4,
    });
  });
});

describe("predictionGroupOf", () => {
  it("sépare les coachs des tribunes", () => {
    expect(predictionGroupOf(true)).toBe("coach");
    expect(predictionGroupOf(false)).toBe("stands");
  });
});

function row(
  userId: string,
  grade: LeaderboardPrediction["grade"],
  overrides: Partial<LeaderboardPrediction> = {},
): LeaderboardPrediction {
  const points = grade === "exact" ? 5 : grade === "outcome" ? 3 : 0;
  return {
    userId,
    displayName: userId.toUpperCase(),
    group: "coach",
    grade,
    points,
    ...overrides,
  };
}

describe("computePredictionLeaderboard", () => {
  it("additionne points, pronostics réglés, bons résultats et scores exacts", () => {
    const board = computePredictionLeaderboard([
      row("a", "exact"),
      row("a", "outcome"),
      row("a", "wrong"),
    ]);
    expect(board.coach).toEqual([
      {
        rank: 1,
        userId: "a",
        displayName: "A",
        group: "coach",
        points: 8,
        settled: 3,
        correct: 2,
        exact: 1,
      },
    ]);
  });

  it("n'expose pas qui a pronostiqué une rencontre encore en attente", () => {
    const board = computePredictionLeaderboard([row("a", "pending")]);
    expect(board.coach).toEqual([]);
  });

  it("garde un forfait pour la présence, sans le compter comme réglé", () => {
    const board = computePredictionLeaderboard([row("a", "void")]);
    expect(board.coach[0]).toMatchObject({ points: 0, settled: 0 });
  });

  it("classe par points, puis scores exacts, puis bons résultats, puis nom", () => {
    const board = computePredictionLeaderboard([
      // b : 6 pts en deux bons résultats
      row("b", "outcome"),
      row("b", "outcome"),
      // c : 5 pts, un score exact
      row("c", "exact"),
      // a : 5 pts, un score exact, un pronostic faux de plus
      row("a", "exact"),
      row("a", "wrong"),
      // d : 3 pts
      row("d", "outcome"),
    ]);
    expect(board.coach.map((e) => [e.userId, e.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["d", 4],
    ]);
  });

  it("sépare les groupes et classe chacun de 1", () => {
    const board = computePredictionLeaderboard([
      row("coach", "outcome"),
      row("fan", "exact", { group: "stands" }),
    ]);
    expect(board.coach.map((e) => [e.userId, e.rank])).toEqual([["coach", 1]]);
    expect(board.stands.map((e) => [e.userId, e.rank])).toEqual([["fan", 1]]);
  });
});

describe("leaderboardLeaders", () => {
  it("rend les premiers ex æquo qui ont marqué", () => {
    const board = computePredictionLeaderboard([
      row("a", "exact"),
      row("b", "exact"),
      row("c", "outcome"),
    ]);
    expect(leaderboardLeaders(board.coach).map((e) => e.userId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("ne sacre personne à zéro point", () => {
    const board = computePredictionLeaderboard([row("a", "wrong")]);
    expect(leaderboardLeaders(board.coach)).toEqual([]);
  });
});
