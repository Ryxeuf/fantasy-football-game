/**
 * E2E API — date prévisionnelle d'une rencontre de ligue.
 *
 * `PATCH /leagues/pairings/:id/schedule` : les deux coachs de la rencontre
 * et le commissaire posent (ou retirent) la date convenue ; un tiers est
 * refusé ; une rencontre jouée n'a plus de date à prévoir. L'autre coach
 * reçoit une notification interne `league.pairing_scheduled`.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPatch, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface PairingDTO {
  id: string;
  status: string;
  scheduledAt: string | null;
  homeParticipant: { team: { ownerId: string } };
  awayParticipant: { team: { ownerId: string } };
}
interface SeasonDetailDTO {
  season: { status: string; rounds: Array<{ pairings: PairingDTO[] }> };
}
interface NotificationsDTO {
  notifications: Array<{ kind: string; body: string; url: string | null }>;
}

const DATE = "2026-09-12T18:30:00.000Z";

async function setup(prefix: string) {
  const alice = await seedAndLogin(`${prefix}-alice@sched.test`, "pwd", "Alice");
  const aliceTeam = await createTeam(alice.userId, `${prefix} Rats`, "skaven");
  const bob = await seedAndLogin(`${prefix}-bob@sched.test`, "pwd", "Bob");
  const bobTeam = await createTeam(bob.userId, `${prefix} Lizards`, "lizardmen");
  const carol = await seedAndLogin(`${prefix}-carol@sched.test`, "pwd", "Carol");
  const tokensByUser = new Map<string, string>([
    [alice.userId, alice.token],
    [bob.userId, bob.token],
  ]);

  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", alice.token, {
      name: `${prefix} Schedule League`,
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
  const pairing = detail.season.rounds[0].pairings[0];
  return {
    leagueId: league.id,
    seasonId: season.id,
    pairing,
    commissioner: alice,
    tokensByUser,
    stranger: carol,
  };
}

async function readPairing(seasonId: string, token: string): Promise<PairingDTO> {
  const detail = unwrap(
    await get<{ data: SeasonDetailDTO }>(`/leagues/seasons/${seasonId}`, token),
  );
  return detail.season.rounds[0].pairings[0];
}

describe("E2E API — date prévisionnelle d'une rencontre", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("un coach de la rencontre pose la date, l'adversaire est notifié", async () => {
    const { leagueId, seasonId, pairing, tokensByUser } = await setup("coach");
    const awayOwner = pairing.awayParticipant.team.ownerId;
    const homeOwner = pairing.homeParticipant.team.ownerId;
    const awayToken = tokensByUser.get(awayOwner)!;
    const homeToken = tokensByUser.get(homeOwner)!;

    const res = await rawPatch(
      `/leagues/pairings/${pairing.id}/schedule`,
      awayToken,
      { scheduledAt: DATE },
    );
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    const body = (await res.json()) as {
      data: { scheduledAt: string; actorRole: string; notified: number };
    };
    expect(body.data.actorRole).toBe("away");
    expect(body.data.notified).toBe(1);
    expect(new Date(body.data.scheduledAt).toISOString()).toBe(DATE);

    const after = await readPairing(seasonId, awayToken);
    expect(after.status).toBe("scheduled");
    expect(new Date(after.scheduledAt!).toISOString()).toBe(DATE);

    // L'autre coach retrouve la proposition dans ses notifications.
    const notifs = unwrap(
      await get<{ data: NotificationsDTO }>("/notifications", homeToken),
    );
    const scheduled = notifs.notifications.find(
      (n) => n.kind === "league.pairing_scheduled",
    );
    expect(scheduled).toBeTruthy();
    expect(scheduled!.url).toBe(`/leagues/${leagueId}`);
    expect(scheduled!.body).toContain("(J1)");
  });

  it("un tiers est refusé, le commissaire est accepté, null retire la date", async () => {
    const { seasonId, pairing, commissioner, stranger } = await setup("rights");

    const forbidden = await rawPatch(
      `/leagues/pairings/${pairing.id}/schedule`,
      stranger.token,
      { scheduledAt: DATE },
    );
    expect(forbidden.status).toBe(403);

    const invalid = await rawPatch(
      `/leagues/pairings/${pairing.id}/schedule`,
      commissioner.token,
      { scheduledAt: "demain soir" },
    );
    expect(invalid.status).toBe(400);

    const set = await rawPatch(
      `/leagues/pairings/${pairing.id}/schedule`,
      commissioner.token,
      { scheduledAt: DATE },
    );
    expect(set.status).toBe(200);
    expect(
      ((await set.json()) as { data: { actorRole: string } }).data.actorRole,
    ).toBe("commissioner");

    const cleared = await rawPatch(
      `/leagues/pairings/${pairing.id}/schedule`,
      commissioner.token,
      { scheduledAt: null },
    );
    expect(cleared.status).toBe(200);
    const after = await readPairing(seasonId, commissioner.token);
    expect(after.scheduledAt).toBeNull();

    const missing = await rawPatch(
      `/leagues/pairings/does-not-exist/schedule`,
      commissioner.token,
      { scheduledAt: DATE },
    );
    expect(missing.status).toBe(404);
  });

  it("une rencontre jouée n'a plus de date à prévoir", async () => {
    const { pairing, commissioner } = await setup("played");
    // Forfait : le chemin le plus court vers un statut terminal.
    await post(`/leagues/pairings/${pairing.id}/forfeit`, commissioner.token, {
      side: "home",
    });
    const res = await rawPatch(
      `/leagues/pairings/${pairing.id}/schedule`,
      commissioner.token,
      { scheduledAt: DATE },
    );
    expect(res.status).toBe(409);
  });
});
