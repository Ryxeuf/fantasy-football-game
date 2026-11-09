import { describe, it, expect } from "vitest";
import {
  decideCommissionerWithdrawal,
  type CommissionerWithdrawalInput,
  type WithdrawalPairing,
} from "./league-commissioner-withdrawal-rules";

function pairing(over: Partial<WithdrawalPairing> = {}): WithdrawalPairing {
  return {
    id: "p1",
    roundId: "r1",
    status: "scheduled",
    homeParticipantId: "x",
    awayParticipantId: "o1",
    matchId: null,
    sheetStatus: null,
    sheetEventCount: 0,
    isBracket: false,
    ...over,
  };
}

function decide(over: Partial<CommissionerWithdrawalInput> = {}) {
  return decideCommissionerWithdrawal({
    isCommissioner: true,
    isAdmin: false,
    seasonId: "s1",
    seasonStatus: "in_progress",
    participant: { id: "x", seasonId: "s1", status: "active" },
    remaining: "forfeit",
    openPairings: [],
    ...over,
  });
}

describe("decideCommissionerWithdrawal", () => {
  it.each([
    [
      "ni commissaire ni admin",
      { isCommissioner: false, isAdmin: false },
      "forbidden",
    ],
    ["inscription introuvable", { participant: null }, "participant_not_found"],
    [
      "inscription d'une autre saison",
      { participant: { id: "x", seasonId: "s2", status: "active" } },
      "participant_not_found",
    ],
    ["saison clôturée", { seasonStatus: "completed" }, "season_completed"],
    [
      "déjà retirée",
      { participant: { id: "x", seasonId: "s1", status: "withdrawn" } },
      "already_withdrawn",
    ],
  ] as const)("refuse : %s", (_label, over, code) => {
    expect(decide(over as Partial<CommissionerWithdrawalInput>)).toMatchObject({
      ok: false,
      code,
    });
  });

  it("un admin non commissaire peut retirer", () => {
    expect(decide({ isCommissioner: false, isAdmin: true })).toMatchObject({
      ok: true,
    });
  });

  it("refuse et désigne une rencontre dont la feuille est soumise", () => {
    expect(
      decide({
        openPairings: [
          pairing({ id: "ok" }),
          pairing({ id: "busy", sheetStatus: "submitted_away" }),
          pairing({ id: "draft", sheetStatus: "draft", sheetEventCount: 4 }),
        ],
      }),
    ).toMatchObject({
      ok: false,
      code: "pairing_engaged",
      engagedPairingIds: ["busy", "draft"],
    });
  });

  it("forfait : chaque rencontre restante est perdue par l'équipe retirée, de son côté", () => {
    const out = decide({
      openPairings: [
        pairing({ id: "p-home", homeParticipantId: "x", awayParticipantId: "o1" }),
        pairing({ id: "p-away", homeParticipantId: "o2", awayParticipantId: "x" }),
      ],
    });
    expect(out).toEqual({
      ok: true,
      plan: {
        forfeit: [
          { pairingId: "p-home", side: "home" },
          { pairingId: "p-away", side: "away" },
        ],
        cancel: [],
        placeholders: [],
      },
    });
  });

  it("annulation : la saison régulière s'annule, le bracket reste un forfait", () => {
    const out = decide({
      remaining: "cancel",
      openPairings: [
        pairing({ id: "reg", roundId: "r3" }),
        pairing({
          id: "sf1",
          roundId: "r9",
          isBracket: true,
          homeParticipantId: "o1",
          awayParticipantId: "x",
        }),
      ],
    });
    expect(out).toEqual({
      ok: true,
      plan: {
        forfeit: [{ pairingId: "sf1", side: "away" }],
        cancel: [{ pairingId: "reg", roundId: "r3" }],
        placeholders: [],
      },
    });
  });

  it("un placeholder de bracket est laissé au commissaire", () => {
    const out = decide({
      openPairings: [
        pairing({
          id: "final",
          isBracket: true,
          homeParticipantId: "x",
          awayParticipantId: "x",
        }),
      ],
    });
    expect(out).toEqual({
      ok: true,
      plan: { forfeit: [], cancel: [], placeholders: ["final"] },
    });
  });

  it("avant-saison : aucune rencontre, simple retrait", () => {
    expect(decide({ seasonStatus: "scheduled" })).toEqual({
      ok: true,
      plan: { forfeit: [], cancel: [], placeholders: [] },
    });
  });
});
