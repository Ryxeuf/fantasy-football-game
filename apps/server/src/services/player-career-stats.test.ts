import { describe, expect, it } from "vitest";
import {
  EMPTY_CAREER_COUNTERS,
  applyCareerAdjustment,
  computeCompetitionCareerAdjustments,
  persistedPlayerIdsFromOfflineSnapshot,
  resolveSnapshotPlayerIds,
  sheetSideParticipants,
  type CareerSheet,
  type CareerTeamPlayer,
} from "./player-career-stats";

const HOME = "team-home";
const AWAY = "team-away";

const players: CareerTeamPlayer[] = [
  { id: "h1", teamId: HOME, number: 1, name: "Bohémond", position: "grail-knight" },
  { id: "h2", teamId: HOME, number: 2, name: "Gauvain", position: "blitzer" },
  { id: "h3", teamId: HOME, number: 3, name: "Perceval", position: "lineman" },
  { id: "a1", teamId: AWAY, number: 1, name: "Grob", position: "blitzer" },
  { id: "a2", teamId: AWAY, number: 2, name: "Snik", position: "lineman" },
];

function snapshot(entries: ReadonlyArray<Record<string, unknown>>): string {
  return JSON.stringify({ roster: "bretonnian", players: entries });
}

function cupSheet(overrides: Partial<CareerSheet> = {}): CareerSheet {
  return {
    kind: "cup",
    homeTeamId: HOME,
    awayTeamId: AWAY,
    forfeit: false,
    motmPlayerIds: [],
    rosterSnapshotHome: snapshot([{ id: "h1" }, { id: "h2" }, { id: "h3" }]),
    rosterSnapshotAway: snapshot([{ id: "a1" }, { id: "a2" }]),
    events: [],
    ...overrides,
  };
}

describe("resolveSnapshotPlayerIds", () => {
  it("lit l'id des snapshots récents", () => {
    expect(
      resolveSnapshotPlayerIds(snapshot([{ id: "h1" }, { id: "h3" }]), players),
    ).toEqual(["h1", "h3"]);
  });

  it("ignore un id qui n'est pas un joueur de l'équipe", () => {
    expect(resolveSnapshotPlayerIds(snapshot([{ id: "a1" }]), players.slice(0, 3))).toEqual([]);
  });

  it("résout un snapshot antérieur par numéro + nom + poste", () => {
    const legacy = snapshot([
      { number: 2, name: "Gauvain", position: "blitzer" },
      // Journalier baké : aucun TeamPlayer à ce poste → rien.
      { number: 12, name: "Journalier 1", position: "Trois-quart" },
    ]);
    expect(resolveSnapshotPlayerIds(legacy, players)).toEqual(["h2"]);
  });

  it("ne devine pas quand la correspondance n'est pas unique", () => {
    const twins: CareerTeamPlayer[] = [
      { id: "x1", teamId: HOME, number: 4, name: "Jumeau", position: "lineman" },
      { id: "x2", teamId: HOME, number: 4, name: "Jumeau", position: "lineman" },
    ];
    expect(
      resolveSnapshotPlayerIds(
        snapshot([{ number: 4, name: "Jumeau", position: "lineman" }]),
        twins,
      ),
    ).toEqual([]);
  });

  it("tolère objet natif, chaîne vide et contenu illisible", () => {
    expect(resolveSnapshotPlayerIds({ players: [{ id: "h1" }] }, players)).toEqual(["h1"]);
    expect(resolveSnapshotPlayerIds("", players)).toEqual([]);
    expect(resolveSnapshotPlayerIds("{oops", players)).toEqual([]);
    expect(resolveSnapshotPlayerIds(null, players)).toEqual([]);
    expect(resolveSnapshotPlayerIds({ headerOnly: true }, players)).toEqual([]);
  });
});

describe("sheetSideParticipants", () => {
  it("ajoute à la version du match les joueurs cités par le journal (victimes comprises) et le JDM", () => {
    const participants = sheetSideParticipants({
      snapshot: null,
      events: [
        { kind: "touchdown", team: "away", actorPlayerId: "a1" },
        // h2 est la VICTIME d'un blocage adverse : il a joué.
        { kind: "casualty", team: "away", actorPlayerId: "a1", targetPlayerId: "h2" },
      ],
      motmPlayerIds: JSON.stringify(["h3"]),
      teamPlayers: players.filter((p) => p.teamId === HOME),
    });
    expect([...participants].sort()).toEqual(["h2", "h3"]);
  });

  it("ignore les joueurs synthétiques de la feuille", () => {
    const participants = sheetSideParticipants({
      snapshot: null,
      events: [{ kind: "touchdown", team: "home", actorPlayerId: "journeyman-home-1" }],
      motmPlayerIds: ["star-home-morg"],
      teamPlayers: players.filter((p) => p.teamId === HOME),
    });
    expect(participants.size).toBe(0);
  });
});

describe("persistedPlayerIdsFromOfflineSnapshot", () => {
  it("lit les lignes de stats du snapshot de validation", () => {
    expect(
      persistedPlayerIdsFromOfflineSnapshot(
        JSON.stringify({ input: { playerStats: [{ teamPlayerId: "h1" }, { teamPlayerId: "h2" }] } }),
      ),
    ).toEqual(["h1", "h2"]);
  });

  it("rend null sans snapshot exploitable", () => {
    expect(persistedPlayerIdsFromOfflineSnapshot(null)).toBeNull();
    expect(persistedPlayerIdsFromOfflineSnapshot({ input: {} })).toBeNull();
    expect(persistedPlayerIdsFromOfflineSnapshot("pas du json")).toBeNull();
  });
});

describe("computeCompetitionCareerAdjustments — coupe", () => {
  it("compte le match, les TD, les sorties au contact, passes, interceptions et JDM", () => {
    const adjustments = computeCompetitionCareerAdjustments({
      players,
      sheets: [
        cupSheet({
          motmPlayerIds: ["h1"],
          events: [
            { kind: "touchdown", team: "home", actorPlayerId: "h1" },
            { kind: "touchdown", team: "home", actorPlayerId: "h1" },
            { kind: "casualty", team: "home", actorPlayerId: "h1", targetPlayerId: "a2", causeDetail: "block", injurySeverity: "badly_hurt" },
            { kind: "pass_complete", team: "home", actorPlayerId: "h2", targetPlayerId: "h1" },
            { kind: "interception", team: "away", actorPlayerId: "a1" },
          ],
        }),
      ],
    });
    expect(adjustments.get("h1")?.cup).toEqual({
      matchesPlayed: 1,
      touchdowns: 2,
      casualties: 1,
      completions: 0,
      interceptions: 0,
      mvpAwards: 1,
    });
    expect(adjustments.get("h2")?.cup.completions).toBe(1);
    // Aligné sans rien marquer : il a joué.
    expect(adjustments.get("h3")?.cup).toEqual({ ...EMPTY_CAREER_COUNTERS, matchesPlayed: 1 });
    expect(adjustments.get("a1")?.cup.interceptions).toBe(1);
    expect(adjustments.get("a2")?.cup.matchesPlayed).toBe(1);
    expect(adjustments.get("h1")?.leagueMatchesNotPersisted).toBe(0);
  });

  it("une agression qui sort sa cible n'est pas une sortie (règle de la ligue)", () => {
    const adjustments = computeCompetitionCareerAdjustments({
      players,
      sheets: [
        cupSheet({
          events: [
            { kind: "aggression", team: "home", actorPlayerId: "h2", targetPlayerId: "a1", injurySeverity: "dead" },
          ],
        }),
      ],
    });
    expect(adjustments.get("h2")?.cup.casualties).toBe(0);
  });

  it("additionne les rencontres et ignore une feuille déclarée forfait", () => {
    const adjustments = computeCompetitionCareerAdjustments({
      players,
      sheets: [
        cupSheet({ events: [{ kind: "touchdown", team: "home", actorPlayerId: "h1" }] }),
        cupSheet({ events: [{ kind: "touchdown", team: "home", actorPlayerId: "h1" }] }),
        cupSheet({ forfeit: true }),
      ],
    });
    expect(adjustments.get("h1")?.cup.matchesPlayed).toBe(2);
    expect(adjustments.get("h1")?.cup.touchdowns).toBe(2);
  });

  it("ne lit que les équipes suivies", () => {
    const adjustments = computeCompetitionCareerAdjustments({
      players: players.filter((p) => p.teamId === HOME),
      sheets: [cupSheet({ events: [{ kind: "touchdown", team: "away", actorPlayerId: "a1" }] })],
    });
    expect(adjustments.has("a1")).toBe(false);
    expect(adjustments.get("h1")?.cup.matchesPlayed).toBe(1);
  });
});

describe("computeCompetitionCareerAdjustments — ligue", () => {
  function leagueSheet(overrides: Partial<CareerSheet> = {}): CareerSheet {
    return { ...cupSheet(), kind: "league", ...overrides };
  }

  it("ajoute un match aux seuls joueurs que la validation n'a pas crédités", () => {
    const adjustments = computeCompetitionCareerAdjustments({
      players,
      sheets: [leagueSheet({ persistedPlayerIds: ["h1", "a1"] })],
    });
    expect(adjustments.get("h1")).toBeUndefined();
    expect(adjustments.get("h2")?.leagueMatchesNotPersisted).toBe(1);
    expect(adjustments.get("h3")?.leagueMatchesNotPersisted).toBe(1);
    expect(adjustments.get("a2")?.leagueMatchesNotPersisted).toBe(1);
    // La ligue persiste déjà TD / sorties : rien côté coupe.
    expect(adjustments.get("h2")?.cup).toEqual(EMPTY_CAREER_COUNTERS);
  });

  it("rencontre notée par un match EN LIGNE : chaque aligné a déjà son match", () => {
    const adjustments = computeCompetitionCareerAdjustments({
      players,
      sheets: [leagueSheet({ persistedPlayerIds: "all" })],
    });
    expect(adjustments.size).toBe(0);
  });

  it("sans snapshot de validation, rejoue la règle : ligne de stats ou JDM", () => {
    const adjustments = computeCompetitionCareerAdjustments({
      players,
      sheets: [
        leagueSheet({
          persistedPlayerIds: null,
          motmPlayerIds: ["h3"],
          events: [{ kind: "touchdown", team: "home", actorPlayerId: "h1" }],
        }),
      ],
    });
    expect(adjustments.get("h1")).toBeUndefined();
    expect(adjustments.get("h3")).toBeUndefined();
    expect(adjustments.get("h2")?.leagueMatchesNotPersisted).toBe(1);
  });
});

describe("applyCareerAdjustment", () => {
  it("additionne compteurs persistés, matchs de ligue non comptés et coupe", () => {
    const totals = applyCareerAdjustment(
      {
        spp: 6,
        matchesPlayed: 3,
        totalTouchdowns: 1,
        totalCasualties: 2,
        totalCompletions: 0,
        totalInterceptions: 0,
        totalMvpAwards: 1,
      },
      {
        leagueMatchesNotPersisted: 1,
        cup: { matchesPlayed: 2, touchdowns: 3, casualties: 1, completions: 1, interceptions: 1, mvpAwards: 1 },
      },
    );
    expect(totals).toEqual({
      matchesPlayed: 6,
      touchdowns: 4,
      casualties: 3,
      completions: 1,
      interceptions: 1,
      mvpAwards: 2,
      spp: 6,
      cup: { matchesPlayed: 2, touchdowns: 3, casualties: 1, completions: 1, interceptions: 1, mvpAwards: 1 },
    });
  });

  it("sans apport ni compteur, rend zéro", () => {
    expect(applyCareerAdjustment({})).toEqual({
      ...EMPTY_CAREER_COUNTERS,
      spp: 0,
      cup: EMPTY_CAREER_COUNTERS,
    });
  });
});
