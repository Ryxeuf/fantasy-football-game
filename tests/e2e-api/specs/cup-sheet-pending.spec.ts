/**
 * E2E API — feuille de coupe en attente de validation.
 *
 * Une feuille de coupe soumise doit se voir comme en ligue : statut de la
 * feuille servi avec la rencontre (carte de ronde), notification du
 * commissaire qui nomme les équipes et pointe la COUPE, et entrée « cup »
 * dans les matchs à valider. `GET /cup/:id` sert aussi le logo des inscrits.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface CupDTO {
  cup: {
    participants: Array<{ id: string; logoUrl?: string | null }>;
    rounds: Array<{
      pairings: Array<{
        id: string;
        homeTeam: { id: string; name: string; ownerId: string };
        awayTeam: { id: string; name: string; ownerId: string } | null;
        matchSheet?: { status: string } | null;
      }>;
    }>;
  };
}
interface NotificationRow {
  kind: string;
  body: string;
  url: string | null;
}

describe("E2E API — feuille de coupe à valider", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("annonce la feuille soumise, notifie le commissaire vers la coupe", async () => {
    const commish = await seedAndLogin("pv-a@cuppending.test", "pwd", "Pv A");
    const third = await seedAndLogin("pv-c@cuppending.test", "pwd", "Pv C");
    const fourth = await seedAndLogin("pv-d@cuppending.test", "pwd", "Pv D");
    const teamC = await createTeam(third.userId, "Pv Charlie", "lizardmen");
    const teamD = await createTeam(fourth.userId, "Pv Delta", "orc");
    const { cup } = await post<{ cup: { id: string } }>("/cup", commish.token, {
      name: "Coupe à valider",
      ruleset: "season_3",
    });
    // Le commissaire n'a pas d'équipe : il reçoit l'alerte sans jouer.
    await post(`/cup/${cup.id}/register`, third.token, { teamId: teamC.teamId });
    await post(`/cup/${cup.id}/register`, fourth.token, { teamId: teamD.teamId });

    const before = (await get<CupDTO>(`/cup/${cup.id}`, commish.token)).cup;
    for (const p of before.participants) expect(p).toHaveProperty("logoUrl", null);

    await post(`/cup/${cup.id}/validate`, commish.token, {});
    await post(`/cup/${cup.id}/rounds`, commish.token, { system: "random" });
    const detail = (await get<CupDTO>(`/cup/${cup.id}`, commish.token)).cup;
    const pairing = detail.rounds[0].pairings.find((p) => p.awayTeam !== null)!;
    expect(pairing.matchSheet ?? null).toBeNull();

    const tokenByOwner = new Map([
      [third.userId, third.token],
      [fourth.userId, fourth.token],
    ]);
    const homeToken = tokenByOwner.get(pairing.homeTeam.ownerId)!;
    const awayToken = tokenByOwner.get(pairing.awayTeam!.ownerId)!;
    const base = `/cup/pairings/${pairing.id}/sheet`;
    await post(base, homeToken, {});
    await post(`${base}/submit`, homeToken, {});

    const half = (await get<CupDTO>(`/cup/${cup.id}`, commish.token)).cup;
    expect(half.rounds[0].pairings.find((p) => p.id === pairing.id)!.matchSheet).toEqual({
      status: "submitted_home",
    });

    await post(`${base}/submit`, awayToken, {});
    const both = (await get<CupDTO>(`/cup/${cup.id}`, commish.token)).cup;
    expect(both.rounds[0].pairings.find((p) => p.id === pairing.id)!.matchSheet).toEqual({
      status: "both_submitted",
    });

    // La boîte du commissaire : une entrée de COUPE.
    const pending = unwrap(
      await get<{
        data: {
          pending: Array<{ kind: string; leagueId: string; pairingId: string; roundNumber: number }>;
        };
      }>("/leagues/me/pending-validations", commish.token),
    ).pending;
    expect(pending).toEqual([
      expect.objectContaining({ kind: "cup", leagueId: cup.id, pairingId: pairing.id, roundNumber: 1 }),
    ]);

    // La notification nomme les équipes et pointe la page de la coupe.
    let notification: NotificationRow | undefined;
    for (let i = 0; i < 20 && !notification; i++) {
      const list = unwrap(
        await get<{ data: { notifications: NotificationRow[] } }>(
          "/notifications",
          commish.token,
        ),
      ).notifications;
      notification = list.find((n) => n.kind === "league.match_validation");
      if (!notification) await new Promise((r) => setTimeout(r, 50));
    }
    expect(notification).toBeDefined();
    expect(notification!.url).toBe(`/cups/${cup.id}/pending-validations`);
    expect(notification!.body).toBe(
      `Match a valider : ${pairing.homeTeam.name} vs ${pairing.awayTeam!.name}`,
    );
  });
});
