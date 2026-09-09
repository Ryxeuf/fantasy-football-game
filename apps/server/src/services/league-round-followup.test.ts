import { describe, it, expect } from "vitest";
import {
  REMINDER_BODIES,
  buildReminderEmailText,
  buildReminderSubject,
  selectReminderTargets,
  type ReminderPairing,
} from "./league-round-followup";

const NOW = new Date("2026-09-09T12:00:00.000Z");
const PAST = new Date("2026-09-01T20:30:00.000Z");
const FUTURE = new Date("2026-09-20T20:30:00.000Z");

function pairing(over: Partial<ReminderPairing> = {}): ReminderPairing {
  return {
    id: "p1",
    status: "scheduled",
    scheduledAt: null,
    matchSheetStatus: null,
    ...over,
  };
}

describe("selectReminderTargets", () => {
  it("relance une rencontre ouverte SANS date convenue", () => {
    const targets = selectReminderTargets([pairing()], NOW);
    expect(targets).toHaveLength(1);
    expect(targets[0].reason).toBe("not_scheduled");
  });

  it("relance une rencontre dont la date est DÉPASSÉE sans feuille", () => {
    const targets = selectReminderTargets(
      [pairing({ scheduledAt: PAST })],
      NOW,
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].reason).toBe("sheet_overdue");
  });

  it("laisse tranquille une rencontre planifiée dans le futur", () => {
    expect(selectReminderTargets([pairing({ scheduledAt: FUTURE })], NOW)).toEqual(
      [],
    );
  });

  it("relance une rencontre due à l'instant précis (date atteinte)", () => {
    const targets = selectReminderTargets(
      [pairing({ scheduledAt: new Date(NOW) })],
      NOW,
    );
    expect(targets.map((t) => t.reason)).toEqual(["sheet_overdue"]);
  });

  it.each(["submitted_home", "submitted_away", "both_submitted", "validated"])(
    "n'insiste pas quand la feuille est parvenue au commissaire (%s)",
    (status) => {
      expect(
        selectReminderTargets(
          [pairing({ scheduledAt: PAST, matchSheetStatus: status })],
          NOW,
        ),
      ).toEqual([]);
    },
  );

  it.each(["draft", "invalidated"])(
    "relance encore quand la feuille n'est PAS parvenue (%s)",
    (status) => {
      const targets = selectReminderTargets(
        [pairing({ scheduledAt: PAST, matchSheetStatus: status })],
        NOW,
      );
      expect(targets.map((t) => t.reason)).toEqual(["sheet_overdue"]);
    },
  );

  it.each(["played", "forfeit_home", "forfeit_away", "cancelled"])(
    "ne relance jamais une rencontre close (%s)",
    (status) => {
      expect(
        selectReminderTargets(
          [pairing({ status, scheduledAt: null }), pairing({ status, scheduledAt: PAST })],
          NOW,
        ),
      ).toEqual([]);
    },
  );

  it("relance aussi une rencontre en cours dont la date est passée", () => {
    const targets = selectReminderTargets(
      [pairing({ status: "in_progress", scheduledAt: PAST })],
      NOW,
    );
    expect(targets.map((t) => t.reason)).toEqual(["sheet_overdue"]);
  });

  it("trie chaque rencontre dans SON cas, sur une journée mélangée", () => {
    const targets = selectReminderTargets(
      [
        pairing({ id: "a" }),
        pairing({ id: "b", scheduledAt: PAST }),
        pairing({ id: "c", scheduledAt: FUTURE }),
        pairing({ id: "d", status: "played", scheduledAt: PAST }),
        pairing({ id: "e", scheduledAt: PAST, matchSheetStatus: "validated" }),
      ],
      NOW,
    );
    expect(targets.map((t) => [t.pairing.id, t.reason])).toEqual([
      ["a", "not_scheduled"],
      ["b", "sheet_overdue"],
    ]);
  });

  it("ne renvoie rien sur une journée vide", () => {
    expect(selectReminderTargets([], NOW)).toEqual([]);
  });
});

describe("rédaction des relances", () => {
  it("reprend AU MOT PRÈS le message « match non planifié »", () => {
    expect(REMINDER_BODIES.not_scheduled).toBe(
      "Ton match de la journée en cours n'est pas encore planifié. Contacte " +
        "rapidement ton adversaire pour fixer une date ou le commissaire pour " +
        "signaler tout PB. Merci",
    );
  });

  it("reprend AU MOT PRÈS le message « feuille attendue »", () => {
    expect(REMINDER_BODIES.sheet_overdue).toBe(
      "La feuille de match de la journée en cours n'est pas parvenue au " +
        "commissaire alors que le match a dû se dérouler. Merci de faire le " +
        "nécessaire rapidement et de prévenir le commissaire",
    );
  });

  it("situe le match relancé dans sa ligue et sa journée", () => {
    const text = buildReminderEmailText("not_scheduled", {
      leagueName: "Ligue du Mordorbihan",
      roundNumber: 3,
      matchLabel: "Reikland vs Skavenblight",
      leagueUrl: "https://nuffle.example/leagues/lg-1",
    });
    expect(text).toContain("Ligue du Mordorbihan — Journée 3");
    expect(text).toContain("Reikland vs Skavenblight");
    expect(text).toContain(REMINDER_BODIES.not_scheduled);
    expect(text).toContain("https://nuffle.example/leagues/lg-1");
  });

  it("se passe du lien quand l'origine web est inconnue", () => {
    const text = buildReminderEmailText("sheet_overdue", {
      leagueName: "L",
      roundNumber: 1,
      matchLabel: "A vs B",
      leagueUrl: null,
    });
    expect(text).toContain(REMINDER_BODIES.sheet_overdue);
    expect(text).not.toContain("Voir la journée");
  });

  it("écrit un objet lisible dans une boîte mail", () => {
    expect(
      buildReminderSubject("not_scheduled", {
        leagueName: "Ligue du Mordorbihan",
        roundNumber: 3,
      }),
    ).toBe("[Ligue du Mordorbihan] J3 — Match non planifié");
    expect(
      buildReminderSubject("sheet_overdue", {
        leagueName: "Ligue du Mordorbihan",
        roundNumber: 3,
      }),
    ).toBe("[Ligue du Mordorbihan] J3 — Feuille de match attendue");
  });
});
