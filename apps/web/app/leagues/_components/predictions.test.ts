import { describe, it, expect } from "vitest";
import {
  describePrediction,
  draftFromPrediction,
  featuredRound,
  formatClosesAt,
  openPredictableCount,
  outcomeOf,
  parsePredictionScope,
  pickLabel,
  pickShare,
  pointsLabel,
  roundLabel,
  validatePredictionDraft,
  viewerEntry,
  type LeaderboardEntryView,
  type PairingPredictionsView,
  type RoundPredictionsView,
} from "./predictions";

function pairing(
  overrides: Partial<PairingPredictionsView> = {},
): PairingPredictionsView {
  return {
    id: "pair-1",
    status: "scheduled",
    scheduledAt: null,
    closesAt: null,
    closed: false,
    placeholder: false,
    home: {
      participantId: "p-h",
      teamId: "t-h",
      name: "Orques",
      roster: "orc",
      logoUrl: null,
      coachName: "Alice",
    },
    away: {
      participantId: "p-a",
      teamId: "t-a",
      name: "Elfes",
      roster: "wood_elf",
      logoUrl: null,
      coachName: "Bob",
    },
    result: null,
    eligibility: "ok",
    canClose: false,
    myPrediction: null,
    predictions: null,
    distribution: null,
    ...overrides,
  };
}

function round(
  roundNumber: number,
  pairings: PairingPredictionsView[],
): RoundPredictionsView {
  return {
    id: `r-${roundNumber}`,
    roundNumber,
    name: null,
    status: "pending",
    kind: "regular",
    startDate: null,
    canClose: false,
    pairings,
  };
}

describe("parsePredictionScope", () => {
  it("lit une portée connue telle quelle", () => {
    expect(parsePredictionScope("members")).toBe("members");
    expect(parsePredictionScope("open")).toBe("open");
    expect(parsePredictionScope("off")).toBe("off");
  });

  it("une ligue antérieure (null) ou une valeur inconnue n'a pas de pronostics", () => {
    expect(parsePredictionScope(null)).toBe("off");
    expect(parsePredictionScope(undefined)).toBe("off");
    expect(parsePredictionScope("everyone")).toBe("off");
  });
});

describe("validatePredictionDraft", () => {
  it("exige une issue", () => {
    const out = validatePredictionDraft({ pick: null, homeScore: "", awayScore: "" });
    expect(out.ok).toBe(false);
  });

  it("accepte une issue seule, sans score", () => {
    expect(
      validatePredictionDraft({ pick: "draw", homeScore: "", awayScore: " " }),
    ).toEqual({
      ok: true,
      body: { pick: "draw", homeScore: null, awayScore: null },
    });
  });

  it("accepte un score complet qui donne l'issue choisie", () => {
    expect(
      validatePredictionDraft({ pick: "home", homeScore: "2", awayScore: "1" }),
    ).toEqual({ ok: true, body: { pick: "home", homeScore: 2, awayScore: 1 } });
  });

  it("refuse un score à moitié rempli", () => {
    const out = validatePredictionDraft({
      pick: "home",
      homeScore: "2",
      awayScore: "",
    });
    expect(out).toMatchObject({ ok: false, error: expect.stringMatching(/deux scores/) });
  });

  it("refuse un score qui contredit l'issue (un nul n'est pas une victoire)", () => {
    const out = validatePredictionDraft({
      pick: "home",
      homeScore: "1",
      awayScore: "1",
    });
    expect(out).toMatchObject({ ok: false, error: expect.stringMatching(/issue/) });
  });

  it("refuse un score négatif, décimal ou au-delà de la borne", () => {
    for (const bad of ["-1", "1.5", "31", "abc"]) {
      expect(
        validatePredictionDraft({ pick: "home", homeScore: bad, awayScore: "0" })
          .ok,
      ).toBe(false);
    }
  });
});

describe("draftFromPrediction", () => {
  it("part d'un brouillon vide sans pronostic", () => {
    expect(draftFromPrediction(null)).toEqual({
      pick: null,
      homeScore: "",
      awayScore: "",
    });
  });

  it("reprend le pronostic posé, score compris", () => {
    expect(
      draftFromPrediction({
        pick: "away",
        homeScore: 0,
        awayScore: 2,
        grade: "pending",
        points: 0,
      }),
    ).toEqual({ pick: "away", homeScore: "0", awayScore: "2" });
  });
});

describe("libellés", () => {
  it("nomme le choix par l'équipe", () => {
    expect(pickLabel("home", "Orques", "Elfes")).toBe("Victoire Orques");
    expect(pickLabel("away", "Orques", "Elfes")).toBe("Victoire Elfes");
    expect(pickLabel("draw", "Orques", "Elfes")).toBe("Match nul");
  });

  it("ajoute le score quand il est donné", () => {
    expect(
      describePrediction(
        { pick: "home", homeScore: 2, awayScore: 1 },
        "Orques",
        "Elfes",
      ),
    ).toBe("Victoire Orques (2-1)");
    expect(
      describePrediction(
        { pick: "draw", homeScore: null, awayScore: null },
        "Orques",
        "Elfes",
      ),
    ).toBe("Match nul");
  });

  it("accorde « pt » et nomme une journée sans nom", () => {
    expect(pointsLabel(0)).toBe("0 pt");
    expect(pointsLabel(1)).toBe("1 pt");
    expect(pointsLabel(5)).toBe("5 pts");
    expect(roundLabel({ roundNumber: 3, name: null })).toBe("Journée 3");
    expect(roundLabel({ roundNumber: 3, name: "Finale" })).toBe("Finale");
  });

  it("n'affiche pas d'échéance absente ou illisible", () => {
    expect(formatClosesAt(null)).toBeNull();
    expect(formatClosesAt("pas une date")).toBeNull();
    expect(formatClosesAt("2026-10-01T18:00:00.000Z")).toEqual(
      expect.any(String),
    );
  });

  it("calcule la part d'un choix, sans diviser par zéro", () => {
    expect(pickShare({ home: 1, draw: 1, away: 2, total: 4 }, "away")).toBe(50);
    expect(pickShare({ home: 0, draw: 0, away: 0, total: 0 }, "home")).toBe(0);
  });

  it("outcomeOf suit le score", () => {
    expect(outcomeOf(2, 1)).toBe("home");
    expect(outcomeOf(1, 1)).toBe("draw");
    expect(outcomeOf(0, 3)).toBe("away");
  });
});

describe("featuredRound", () => {
  it("met en avant la première journée qui a une rencontre ouverte", () => {
    const rounds = [
      round(1, [pairing({ closed: true, result: { outcome: "home", homeScore: 1, awayScore: 0 } })]),
      round(2, [pairing({ id: "pair-2" })]),
      round(3, [pairing({ id: "pair-3" })]),
    ];
    expect(featuredRound(rounds)?.roundNumber).toBe(2);
  });

  it("ignore une affiche à venir (bracket) pour choisir la journée ouverte", () => {
    const rounds = [
      round(1, [pairing({ closed: true, result: { outcome: "draw", homeScore: 1, awayScore: 1 } })]),
      round(2, [pairing({ id: "final", placeholder: true })]),
    ];
    expect(featuredRound(rounds)?.roundNumber).toBe(1);
  });

  it("retombe sur la dernière journée jouée, sinon sur rien", () => {
    const played = round(2, [
      pairing({ closed: true, result: { outcome: "away", homeScore: 0, awayScore: 1 } }),
    ]);
    expect(
      featuredRound([
        round(1, [pairing({ closed: true, result: { outcome: "home", homeScore: 1, awayScore: 0 } })]),
        played,
      ])?.roundNumber,
    ).toBe(2);
    expect(featuredRound([round(1, [pairing({ closed: true })])])).toBeNull();
    expect(featuredRound([])).toBeNull();
  });

  it("compte les rencontres que le lecteur peut encore pronostiquer", () => {
    expect(
      openPredictableCount(
        round(1, [
          pairing(),
          pairing({ id: "own", eligibility: "own-match" }),
          pairing({ id: "closed", eligibility: "closed", closed: true }),
        ]),
      ),
    ).toBe(1);
  });
});

describe("viewerEntry", () => {
  const entry = (userId: string, isViewer: boolean): LeaderboardEntryView => ({
    rank: 1,
    userId,
    displayName: userId,
    group: "coach",
    points: 3,
    settled: 1,
    correct: 1,
    exact: 0,
    isViewer,
  });

  it("retrouve la ligne du lecteur, ou rien", () => {
    expect(viewerEntry([entry("a", false), entry("b", true)])?.userId).toBe("b");
    expect(viewerEntry([entry("a", false)])).toBeNull();
  });
});
