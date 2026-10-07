/**
 * E2E API — les Couronnes se gagnent en jouant (change `crowns-earning`).
 *
 * Sur une vraie base : une feuille de ligue validée rapporte au propriétaire
 * de CHAQUE côté, crédité au rattrapage de `GET /crowns/me` (avec le bonus de
 * bienvenue au premier passage) ; une seconde lecture ne crédite rien ; une
 * invalidation puis une revalidation ne changent rien ; le journal détaille
 * chaque passage et l'admin voit le registre. Flag `crowns` ouvert en CI
 * (`FEATURE_FLAGS_FORCE_ENABLED`).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

// Barème de départ (`crowns-rewards-rules`, DEFAULT_CROWNS_REWARD_SCHEDULE).
const SIGNUP = 250;
const SHEET = 25;

interface CrownsTx {
  id: string;
  type: string;
  amount: number;
  ref: string | null;
  rewards?: { sheets: number; achievements: number; signup: boolean; capped: number };
}
interface Crowns {
  balance: number;
  transactions: CrownsTx[];
  schedule: { sheet: number; signup: number; achievement: number; seasonSheetCap: number };
}
interface SeasonDetailDTO {
  season: {
    rounds: Array<{
      pairings: Array<{
        id: string;
        homeParticipant: { team: { ownerId: string } };
        awayParticipant: { team: { ownerId: string } };
      }>;
    }>;
  };
}

async function setupLeague() {
  const users = await Promise.all(
    ["alice", "bob", "carol", "dan"].map((n) =>
      seedAndLogin(`${n}@crowns.test`, "pwd", n[0].toUpperCase() + n.slice(1)),
    ),
  );
  const [alice] = users;
  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", alice.token, {
      name: "Ligue des Couronnes",
      maxParticipants: 4,
    }),
  );
  const season = unwrap(
    await post<{ data: { id: string } }>(`/leagues/${league.id}/seasons`, alice.token, { name: "S1" }),
  );
  for (const [i, u] of users.entries()) {
    const team = await createTeam(u.userId, `Équipe ${i}`, i % 2 === 0 ? "skaven" : "lizardmen");
    await post(`/leagues/seasons/${season.id}/join`, u.token, { teamId: team.teamId });
  }
  await post(`/leagues/seasons/${season.id}/start`, alice.token, {});
  const detail = unwrap(
    await get<{ data: SeasonDetailDTO }>(`/leagues/seasons/${season.id}`, alice.token),
  );
  const pairing = detail.season.rounds[0].pairings[0];
  const tokenOf = new Map(users.map((u) => [u.userId, u.token]));
  return {
    commissionerToken: alice.token,
    homeUserId: pairing.homeParticipant.team.ownerId,
    homeToken: tokenOf.get(pairing.homeParticipant.team.ownerId)!,
    awayToken: tokenOf.get(pairing.awayParticipant.team.ownerId)!,
    sheetUrl: `/leagues/pairings/${pairing.id}/sheet`,
  };
}

async function validateSheet(s: Awaited<ReturnType<typeof setupLeague>>) {
  await post(`${s.sheetUrl}/submit`, s.homeToken, {});
  await post(`${s.sheetUrl}/submit`, s.awayToken, {});
  const validated = unwrap(
    await post<{ data: { sheet: { status: string } } }>(`${s.sheetUrl}/validate`, s.commissionerToken, {}),
  );
  expect(validated.sheet.status).toBe("validated");
}

describe("E2E API — Couronnes gagnées en jouant", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("bonus de bienvenue au premier passage, barème servi", async () => {
    const coach = await seedAndLogin("solo@crowns.test", "pwd", "Solo");
    const crowns = await get<Crowns>("/crowns/me", coach.token);
    expect(crowns.balance).toBe(SIGNUP);
    expect(crowns.schedule).toMatchObject({ sheet: SHEET, signup: SIGNUP });
    expect(crowns.transactions).toHaveLength(1);
    expect(crowns.transactions[0]).toMatchObject({ type: "REWARD", amount: SIGNUP });
    expect(crowns.transactions[0].ref).toMatch(/^rewards:/);
    expect(crowns.transactions[0].rewards).toEqual({ sheets: 0, achievements: 0, signup: true, capped: 0 });

    // Seconde lecture : rien de plus.
    const again = await get<Crowns>("/crowns/me", coach.token);
    expect(again.balance).toBe(SIGNUP);
    expect(again.transactions).toHaveLength(1);
  });

  it("feuille validée : chaque côté payé une fois, invalidation et revalidation sans effet", async () => {
    const s = await setupLeague();
    await post(s.sheetUrl, s.homeToken, {});

    // Le domicile lit son solde AVANT la validation : bonus seul.
    expect((await get<Crowns>("/crowns/me", s.homeToken)).balance).toBe(SIGNUP);

    await validateSheet(s);

    // Domicile : un passage de plus, la feuille.
    const home = await get<Crowns>("/crowns/me", s.homeToken);
    expect(home.balance).toBe(SIGNUP + SHEET);
    expect(home.transactions[0]).toMatchObject({ type: "REWARD", amount: SHEET });
    expect(home.transactions[0].rewards).toEqual({ sheets: 1, achievements: 0, signup: false, capped: 0 });

    // Extérieur : premier passage = bonus + feuille, en UNE opération.
    const away = await get<Crowns>("/crowns/me", s.awayToken);
    expect(away.balance).toBe(SIGNUP + SHEET);
    expect(away.transactions).toHaveLength(1);
    expect(away.transactions[0].rewards).toEqual({ sheets: 1, achievements: 0, signup: true, capped: 0 });

    // Seconde lecture : inchangé.
    expect((await get<Crowns>("/crowns/me", s.homeToken)).transactions).toHaveLength(2);

    // Invalidation : la participation reste payée.
    const inval = unwrap(
      await post<{ data: { sheet: { status: string } } }>(`${s.sheetUrl}/invalidate`, s.commissionerToken, {
        reason: "E2E couronnes",
      }),
    );
    expect(inval.sheet.status).toBe("invalidated");
    expect((await get<Crowns>("/crowns/me", s.homeToken)).balance).toBe(SIGNUP + SHEET);

    // Revalidation : pas de second versement.
    await validateSheet(s);
    const homeAfter = await get<Crowns>("/crowns/me", s.homeToken);
    expect(homeAfter.balance).toBe(SIGNUP + SHEET);
    expect(homeAfter.transactions).toHaveLength(2);
    expect((await get<Crowns>("/crowns/me", s.awayToken)).balance).toBe(SIGNUP + SHEET);

    // L'admin voit le registre du domicile : la feuille et le bonus.
    const admin = await seedAndLogin("admin@crowns.test", "pwd", "Admin", { role: "admin" });
    const registry = await get<{ rewards: Array<{ kind: string; amount: number; sourceKey: string }> }>(
      `/admin/coach-cosmetics/${s.homeUserId}/crowns-rewards`,
      admin.token,
    );
    expect(registry.rewards.map((r) => [r.kind, r.amount]).sort()).toEqual([
      ["sheet", SHEET],
      ["signup", SIGNUP],
    ]);
    expect(registry.rewards.find((r) => r.kind === "sheet")!.sourceKey).toMatch(/^sheet:.+:home$/);
  });
});
