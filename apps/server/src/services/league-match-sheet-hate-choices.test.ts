/**
 * Haine (X) — le Mot-clé haï se choisit, côté service (Prisma mocké,
 * dérivations pures réelles).
 *
 * Scénario : les Morts-Vivants (domicile) affrontent des Humains (extérieur).
 * Un Zombie met un Trois-quart humain sur la touche. Le Zombie porte TROIS
 * lignées — Humain, Mort-Vivant, Zombie — et c'est au coach humain de dire
 * laquelle son joueur haïra.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leaguePairing: { findUnique: vi.fn(), count: vi.fn() },
    cupPairing: { findUnique: vi.fn() },
    cupParticipant: { findMany: vi.fn() },
    leagueMatchSheet: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueMatchEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    team: { findMany: vi.fn() },
    match: { findFirst: vi.fn() },
    roster: { findMany: vi.fn() },
  },
}));

vi.mock("./league-offline-result", () => ({
  recordOfflineLeagueResult: vi.fn(),
  OFFLINE_MATCH_MODE: "offline",
}));
vi.mock("./league-offline-edit", () => ({
  reverseOfflineLeagueResult: vi.fn(),
}));
vi.mock("./cup-roster-snapshot", () => ({
  captureRosterSnapshot: vi.fn(),
  parseRosterSnapshot: vi.fn(() => null),
}));
vi.mock("./push-notifications", () => ({
  sendLeagueMatchValidationPush: vi.fn(),
}));
vi.mock("../utils/team-values", async () => {
  const { getSpecialRulesForTeam } = await import("@bb/game-engine");
  return {
    updateTeamValues: vi.fn(),
    resolveSpecialRulesForTeam: vi.fn(
      (_db: unknown, rosterSlug: string, ruleset: string) =>
        Promise.resolve(getSpecialRulesForTeam(rosterSlug, ruleset as never)),
    ),
  };
});
vi.mock("./roster-staff-config", () => ({
  resolveStaffConfigBySlug: vi.fn(() =>
    Promise.resolve({ apothecaryAllowed: false }),
  ),
}));
vi.mock("./league-sheet-advancements", () => ({
  parseStagedAdvancements: (raw: unknown) => (Array.isArray(raw) ? raw : []),
  applyStagedAdvancements: vi.fn(),
  reverseAppliedAdvancements: vi.fn(),
}));

import { prisma } from "../prisma";
import { getSpecialRulesForTeam } from "@bb/game-engine";
import { getMatchSheet, updateHateChoices } from "./league-match-sheet";
import {
  resolveSpecialRulesForTeam,
  updateTeamValues,
} from "../utils/team-values";
import { resolveStaffConfigBySlug } from "./roster-staff-config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockResolveSpecialRules =
  resolveSpecialRulesForTeam as unknown as ReturnType<typeof vi.fn>;
const mockResolveStaffConfig =
  resolveStaffConfigBySlug as unknown as ReturnType<typeof vi.fn>;
const mockUpdateTeamValues = updateTeamValues as unknown as ReturnType<
  typeof vi.fn
>;

const HOME = "home-owner";
const AWAY = "away-owner";
const COMMISH = "commish";
const ZOMBIE = "undead_trois_quart_zombie";

/** Les trois lignées d'un Zombie, mots-clés de POSTE exclus. */
const ZOMBIE_KEYWORDS = ["Humain", "Mort-Vivant", "Zombie"];

interface PlayerRow {
  id: string;
  number: number;
  name: string;
  position: string;
  dead: boolean;
  missNextMatch: boolean;
  spp: number;
  skills: string;
  advancements: string;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
}

function undeadPlayers(count: number): PlayerRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `h${i + 1}`,
    number: i + 1,
    name: `Zombie ${i + 1}`,
    position: ZOMBIE,
    dead: false,
    missNextMatch: false,
    spp: 0,
    skills: "fork,instable,regeneration",
    advancements: "[]",
    ma: 4,
    st: 3,
    ag: 4,
    pa: 6,
    av: 9,
  }));
}

function humanPlayers(count: number): PlayerRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `a${i + 1}`,
    number: i + 1,
    name: `Humain ${i + 1}`,
    position: "human_trois_quart",
    dead: false,
    missNextMatch: false,
    spp: 0,
    skills: "",
    advancements: "[]",
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
  }));
}

/** Le Zombie n°1 met le Trois-quart humain n°1 sur la touche (Amoché+). */
const MNG_A1 = {
  id: "ev-mng",
  kind: "casualty",
  team: "home",
  actorPlayerId: "h1",
  targetPlayerId: "a1",
  injurySeverity: "mng",
};

function mockMatch(
  input: {
    sheet?: Record<string, unknown>;
    events?: Array<Record<string, unknown>>;
  } = {},
) {
  mockPrisma.leaguePairing.findUnique.mockResolvedValue({
    id: "pair-1",
    round: { season: { league: { id: "L1", creatorId: COMMISH } } },
    homeParticipant: { teamId: "team-home", team: { ownerId: HOME } },
    awayParticipant: { teamId: "team-away", team: { ownerId: AWAY } },
  });
  mockPrisma.team.findMany.mockResolvedValue([
    {
      id: "team-home",
      name: "Champs Funestes",
      roster: "undead",
      players: undeadPlayers(12),
    },
    {
      id: "team-away",
      name: "Reikland",
      roster: "human",
      players: humanPlayers(11),
    },
  ]);
  const events = input.events ?? [MNG_A1];
  mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
    id: "ms1",
    status: "draft",
    motmPlayerIds: [],
    events,
    ...input.sheet,
  });
  mockPrisma.leagueMatchEvent.findMany.mockResolvedValue(events);
  mockPrisma.leagueMatchSheet.update.mockImplementation(
    async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
  );
}

/** Dernier `hateChoices` écrit par le service (chaîne JSON). */
function writtenHateChoices(): unknown {
  const calls = mockPrisma.leagueMatchSheet.update.mock.calls as Array<
    [{ data: Record<string, unknown> }]
  >;
  const last = [...calls]
    .reverse()
    .find((c) => "hateChoices" in c[0].data);
  return last?.[0].data.hateChoices;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockResolveStaffConfig.mockResolvedValue({ apothecaryAllowed: false });
  mockResolveSpecialRules.mockImplementation(
    (_db: unknown, rosterSlug: string, ruleset: string) =>
      Promise.resolve(getSpecialRulesForTeam(rosterSlug, ruleset as never)),
  );
  mockUpdateTeamValues.mockResolvedValue({ teamValue: 0, currentValue: 0 });
});

describe("getMatchSheet — candidats au jet de Haine", () => {
  it("propose les trois lignées du Zombie au joueur qu'il a blessé", async () => {
    mockMatch();
    const out = await getMatchSheet({ pairingId: "pair-1", userId: AWAY });
    expect(out.hateCandidates).toEqual([
      {
        victimPlayerId: "a1",
        // Le trait revient au BLESSÉ : côté extérieur ici.
        side: "away",
        causerPlayerId: "h1",
        keywords: ZOMBIE_KEYWORDS,
        // Sans choix : premier éligible, comme avant ce champ.
        keyword: "Humain",
        chosen: false,
      },
    ]);
  });

  it("retient le choix stocké sur la feuille", async () => {
    mockMatch({
      sheet: {
        hateChoices: [{ victimPlayerId: "a1", keyword: "Mort-Vivant" }],
      },
    });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: AWAY });
    expect(out.hateCandidates[0]).toMatchObject({
      keyword: "Mort-Vivant",
      chosen: true,
    });
  });

  it("lit le choix sérialisé en chaîne (miroir sqlite)", async () => {
    mockMatch({
      sheet: {
        hateChoices: JSON.stringify([
          { victimPlayerId: "a1", keyword: "Zombie" },
        ]),
      },
    });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: AWAY });
    expect(out.hateCandidates[0]).toMatchObject({
      keyword: "Zombie",
      chosen: true,
    });
  });

  // Un mort n'a plus personne à haïr : pas de jet, donc rien à choisir.
  it("ne propose rien pour une blessure qui ne coûte pas le match suivant", async () => {
    mockMatch({ events: [{ ...MNG_A1, injurySeverity: "dead" }] });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: AWAY });
    expect(out.hateCandidates).toEqual([]);
  });

  // Personne n'inflige une sortie par le public : aucun ennemi à désigner.
  it("ne propose rien pour une sortie sans auteur", async () => {
    mockMatch({
      events: [
        {
          id: "ev-crowd",
          kind: "crowd_surge",
          team: "home",
          actorPlayerId: null,
          targetPlayerId: "a1",
          injurySeverity: "mng",
        },
      ],
    });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: AWAY });
    expect(out.hateCandidates).toEqual([]);
  });

  // Le jet a déjà eu lieu : le Mot-clé est figé, c'est `hateRolls` qui parle.
  it("ne propose plus rien sur une feuille validée", async () => {
    mockMatch({ sheet: { status: "validated" } });
    mockPrisma.match.findFirst.mockResolvedValue(null);
    const out = await getMatchSheet({ pairingId: "pair-1", userId: AWAY });
    expect(out.hateCandidates).toEqual([]);
  });
});

describe("updateHateChoices", () => {
  it("enregistre le Mot-clé retenu par le coach du blessé", async () => {
    mockMatch();
    await updateHateChoices({
      pairingId: "pair-1",
      userId: AWAY,
      choices: [{ victimPlayerId: "a1", keyword: "Mort-Vivant" }],
    });
    expect(writtenHateChoices()).toBe(
      JSON.stringify([{ victimPlayerId: "a1", keyword: "Mort-Vivant" }]),
    );
  });

  it("accepte le commissaire sur les deux côtés", async () => {
    mockMatch();
    await updateHateChoices({
      pairingId: "pair-1",
      userId: COMMISH,
      choices: [{ victimPlayerId: "a1", keyword: "Zombie" }],
    });
    expect(writtenHateChoices()).toContain("Zombie");
  });

  // Le trait est un acquis du blessé : le coach adverse n'a pas à le choisir.
  it("refuse (403) le coach de l'autre côté", async () => {
    mockMatch();
    await expect(
      updateHateChoices({
        pairingId: "pair-1",
        userId: HOME,
        choices: [{ victimPlayerId: "a1", keyword: "Zombie" }],
      }),
    ).rejects.toMatchObject({ code: "hate_wrong_side" });
  });

  it("refuse un Mot-clé qui n'est pas celui de l'adversaire", async () => {
    mockMatch();
    await expect(
      updateHateChoices({
        pairingId: "pair-1",
        userId: AWAY,
        choices: [{ victimPlayerId: "a1", keyword: "Orque" }],
      }),
    ).rejects.toMatchObject({ code: "hate_invalid_keyword" });
  });

  // Les mots-clés de POSTE ne sont jamais éligibles : « Haine (Trois-quart) »
  // couvrirait la moitié du terrain.
  it("refuse un Mot-clé de poste", async () => {
    mockMatch();
    await expect(
      updateHateChoices({
        pairingId: "pair-1",
        userId: AWAY,
        choices: [{ victimPlayerId: "a1", keyword: "Trois-quart" }],
      }),
    ).rejects.toMatchObject({ code: "hate_invalid_keyword" });
  });

  it("refuse un joueur qui n'est pas candidat au jet", async () => {
    mockMatch();
    await expect(
      updateHateChoices({
        pairingId: "pair-1",
        userId: AWAY,
        choices: [{ victimPlayerId: "a7", keyword: "Zombie" }],
      }),
    ).rejects.toMatchObject({ code: "hate_invalid_candidate" });
  });

  it("retire le choix sur null : retour au premier Mot-clé", async () => {
    mockMatch({
      sheet: {
        hateChoices: [{ victimPlayerId: "a1", keyword: "Zombie" }],
      },
    });
    await updateHateChoices({
      pairingId: "pair-1",
      userId: AWAY,
      choices: [{ victimPlayerId: "a1", keyword: null }],
    });
    expect(writtenHateChoices()).toBeNull();
  });

  it("refuse d'éditer une feuille déjà validée", async () => {
    mockMatch({ sheet: { status: "validated" } });
    await expect(
      updateHateChoices({
        pairingId: "pair-1",
        userId: AWAY,
        choices: [{ victimPlayerId: "a1", keyword: "Zombie" }],
      }),
    ).rejects.toMatchObject({ code: "already_validated" });
  });
});
