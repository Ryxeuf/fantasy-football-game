/**
 * E2E API — relance d'une journée de ligue.
 *
 * `POST /leagues/rounds/:roundId/remind` : le commissaire écrit d'un coup aux
 * coachs dont la rencontre n'est pas planifiée, et à ceux dont la date est
 * passée sans que la feuille lui soit parvenue. Réservé au commissaire ; un
 * coach de la ligue et un tiers sont refusés (403).
 *
 * On couvre le vrai chemin : les coachs retrouvent la relance dans leurs
 * notifications internes (canal garanti, indépendant du transport e-mail —
 * absent en CI, où `sendEmail` se contente de journaliser).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPost, rawPatch, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface PairingDTO {
  id: string;
  status: string;
  scheduledAt: string | null;
  homeParticipant: { team: { ownerId: string } };
  awayParticipant: { team: { ownerId: string } };
}
interface RoundDTO {
  id: string;
  roundNumber: number;
  pairings: PairingDTO[];
}
interface SeasonDetailDTO {
  season: { status: string; rounds: RoundDTO[] };
}
interface NotificationsDTO {
  notifications: Array<{
    kind: string;
    title: string;
    body: string;
    url: string | null;
  }>;
}
interface ReminderResult {
  roundId: string;
  roundNumber: number;
  leagueId: string;
  reminders: Array<{
    pairingId: string;
    reason: "not_scheduled" | "sheet_overdue";
    matchLabel: string;
    coaches: string[];
  }>;
  coachesNotified: number;
  pairingsChecked: number;
}

/** Une ligue démarrée à 2 équipes : une journée, une rencontre. */
async function setup(prefix: string) {
  const alice = await seedAndLogin(`${prefix}-alice@remind.test`, "pwd", "Alice");
  const aliceTeam = await createTeam(alice.userId, `${prefix} Rats`, "skaven");
  const bob = await seedAndLogin(`${prefix}-bob@remind.test`, "pwd", "Bob");
  const bobTeam = await createTeam(bob.userId, `${prefix} Lizards`, "lizardmen");
  const carol = await seedAndLogin(`${prefix}-carol@remind.test`, "pwd", "Carol");

  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", alice.token, {
      name: `${prefix} Remind League`,
      maxParticipants: 4,
    }),
  );
  const season = unwrap(
    await post<{ data: { id: string } }>(
      `/leagues/${league.id}/seasons`,
      alice.token,
      { name: "S1" },
    ),
  );
  await post(`/leagues/seasons/${season.id}/join`, alice.token, {
    teamId: aliceTeam.teamId,
  });
  await post(`/leagues/seasons/${season.id}/join`, bob.token, {
    teamId: bobTeam.teamId,
  });
  await post(`/leagues/seasons/${season.id}/start`, alice.token, {});

  const detail = unwrap(
    await get<{ data: SeasonDetailDTO }>(
      `/leagues/seasons/${season.id}`,
      alice.token,
    ),
  );
  const round = detail.season.rounds[0];
  return {
    leagueId: league.id,
    seasonId: season.id,
    round,
    pairing: round.pairings[0],
    commissioner: alice,
    coach: bob,
    stranger: carol,
  };
}

async function remindersOf(token: string) {
  const body = unwrap(
    await get<{ data: NotificationsDTO }>("/notifications", token),
  );
  return body.notifications.filter((n) => n.kind === "league.round_followup");
}

describe("E2E API — relance d'une journée", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("relance les deux coachs d'une rencontre non planifiée", async () => {
    const { leagueId, round, pairing, commissioner, coach } =
      await setup("plain");

    const res = await rawPost(
      `/leagues/rounds/${round.id}/remind`,
      commissioner.token,
      {},
    );
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    const body = (await res.json()) as { data: ReminderResult };
    expect(body.data).toMatchObject({
      roundId: round.id,
      leagueId,
      coachesNotified: 2,
      pairingsChecked: 1,
    });
    expect(body.data.reminders).toHaveLength(1);
    expect(body.data.reminders[0]).toMatchObject({
      pairingId: pairing.id,
      reason: "not_scheduled",
    });

    // Les deux coachs retrouvent la relance, avec le message attendu.
    for (const token of [commissioner.token, coach.token]) {
      const notifs = await remindersOf(token);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].body).toContain("n'est pas encore planifié");
      expect(notifs[0].url).toBe(`/leagues/${leagueId}#journee-${round.roundNumber}`);
    }
  });

  it("ne relance pas une rencontre planifiée dans le futur", async () => {
    const { round, pairing, commissioner, coach } = await setup("future");
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const patched = await rawPatch(
      `/leagues/pairings/${pairing.id}/schedule`,
      commissioner.token,
      { scheduledAt: future },
    );
    expect(patched.status).toBe(200);

    const res = await rawPost(
      `/leagues/rounds/${round.id}/remind`,
      commissioner.token,
      {},
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: ReminderResult };
    expect(body.data.reminders).toEqual([]);
    expect(body.data.coachesNotified).toBe(0);
    expect(body.data.pairingsChecked).toBe(1);
    expect(await remindersOf(coach.token)).toEqual([]);
  });

  it("réclame la feuille quand la date est dépassée", async () => {
    const { round, pairing, commissioner, coach } = await setup("overdue");
    const past = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    await rawPatch(
      `/leagues/pairings/${pairing.id}/schedule`,
      commissioner.token,
      { scheduledAt: past },
    );

    const res = await rawPost(
      `/leagues/rounds/${round.id}/remind`,
      commissioner.token,
      {},
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: ReminderResult };
    expect(body.data.reminders.map((r) => r.reason)).toEqual(["sheet_overdue"]);

    const notifs = await remindersOf(coach.token);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].body).toContain("n'est pas parvenue au");
  });

  it("refuse un coach de la ligue et un tiers (403), sans rien envoyer", async () => {
    const { round, coach, stranger } = await setup("forbidden");

    for (const token of [coach.token, stranger.token]) {
      const res = await rawPost(
        `/leagues/rounds/${round.id}/remind`,
        token,
        {},
      );
      expect(res.status).toBe(403);
    }
    expect(await remindersOf(coach.token)).toEqual([]);
  });

  it("refuse sans token (401) et sur une journée inconnue (404)", async () => {
    const { round, commissioner } = await setup("guards");

    expect((await rawPost(`/leagues/rounds/${round.id}/remind`, null, {})).status).toBe(
      401,
    );
    expect(
      (await rawPost("/leagues/rounds/inconnue/remind", commissioner.token, {}))
        .status,
    ).toBe(404);
  });

  it("est rejouable : une journée qui traîne se relance autant que voulu", async () => {
    const { round, commissioner, coach } = await setup("replay");

    for (let i = 0; i < 2; i += 1) {
      const res = await rawPost(
        `/leagues/rounds/${round.id}/remind`,
        commissioner.token,
        {},
      );
      expect(res.status).toBe(200);
    }
    // Chaque relance laisse sa trace : rien n'est écrasé ni dédoublonné.
    expect(await remindersOf(coach.token)).toHaveLength(2);
  });
});
