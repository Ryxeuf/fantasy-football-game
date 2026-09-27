/**
 * Fabriques de vues de pronostics pour les tests (panneau, page, cartes).
 */
import type {
  LeaderboardEntryView,
  PairingPredictionsView,
  RoundPredictionsView,
  SeasonPredictionLeaderboardView,
  SeasonPredictionsView,
} from "./predictions";

export function makePairing(
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

export function makeRound(
  overrides: Partial<RoundPredictionsView> = {},
): RoundPredictionsView {
  return {
    id: "round-1",
    roundNumber: 1,
    name: null,
    status: "pending",
    kind: "regular",
    startDate: null,
    canClose: false,
    pairings: [makePairing()],
    ...overrides,
  };
}

export function makeView(
  overrides: Partial<SeasonPredictionsView> = {},
): SeasonPredictionsView {
  return {
    seasonId: "season-1",
    leagueId: "lg-1",
    scope: "members",
    scopeConfigured: true,
    viewer: {
      userId: "u-viewer",
      isCommissioner: false,
      isMember: true,
      group: "coach",
    },
    rounds: [makeRound()],
    ...overrides,
  };
}

export function makeEntry(
  overrides: Partial<LeaderboardEntryView> = {},
): LeaderboardEntryView {
  return {
    rank: 1,
    userId: "u-1",
    displayName: "Alice",
    group: "coach",
    points: 5,
    settled: 1,
    correct: 1,
    exact: 1,
    isViewer: false,
    ...overrides,
  };
}

export function makeBoard(
  overrides: Partial<SeasonPredictionLeaderboardView> = {},
): SeasonPredictionLeaderboardView {
  return {
    seasonId: "season-1",
    scope: "members",
    coach: [makeEntry()],
    stands: [],
    ...overrides,
  };
}
