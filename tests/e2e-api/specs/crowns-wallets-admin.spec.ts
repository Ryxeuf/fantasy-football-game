import { beforeEach, describe, expect, it } from "vitest";
import { get, rawGet, rawPost, resetDb } from "../helpers/api";
import { API_BASE } from "../helpers/env";
import { seedAndLogin } from "../helpers/factories";

/**
 * Admin des Couronnes et des wallets, sur une vraie base : un coach sans
 * wallet se repère (filtre « sans wallet »), se corrige (création unitaire
 * idempotente, puis création en masse), et la vue d'ensemble / le journal
 * reflètent un crédit admin suivi d'un achat de thème de dés.
 */

interface WalletPage {
  items: Array<{ id: string; wallet: { crowns: number; transactions: number } | null }>;
  total: number;
  counts: { all: number; with: number; without: number };
}

async function send(method: "PATCH" | "POST", path: string, token: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

describe("E2E API — admin des Couronnes et des wallets", () => {
  let admin: { token: string; userId: string };
  let coach: { token: string; userId: string };
  let other: { token: string; userId: string };

  beforeEach(async () => {
    await resetDb();
    admin = await seedAndLogin("admin-crowns@ffa.test", "password-a", "Admin Couronnes", { role: "admin" });
    coach = await seedAndLogin("coach-crowns@ffa.test", "password-c", "Coach Couronnes");
    other = await seedAndLogin("other-crowns@ffa.test", "password-o", "Autre Coach");
  });

  it("repère un coach sans wallet et lui en crée un (idempotent)", async () => {
    let page = await get<WalletPage>("/admin/wallets?status=without&search=Coach%20Couronnes", admin.token);
    expect(page.items.map((u) => u.id)).toEqual([coach.userId]);
    expect(page.items[0].wallet).toBeNull();

    const detailBefore = await get<any>(`/admin/wallets/${coach.userId}`, admin.token);
    expect(detailBefore.wallet.exists).toBe(false);

    let res = await send("POST", `/admin/wallets/${coach.userId}`, admin.token);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: true, wallet: { userId: coach.userId, crowns: 0 } });

    res = await send("POST", `/admin/wallets/${coach.userId}`, admin.token);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);

    page = await get<WalletPage>("/admin/wallets?status=with&search=Coach%20Couronnes", admin.token);
    expect(page.items[0]).toMatchObject({ id: coach.userId, wallet: { crowns: 0, transactions: 0 } });
    expect((await get<any>(`/admin/wallets/${coach.userId}`, admin.token)).wallet.exists).toBe(true);

    res = await send("POST", "/admin/wallets/ghost-user", admin.token);
    expect(res.status).toBe(404);
  });

  it("crée tous les wallets manquants d'un coup", async () => {
    const before = await get<WalletPage>("/admin/wallets", admin.token);
    expect(before.counts.without).toBeGreaterThanOrEqual(3);

    const res = await send("POST", "/admin/wallets/create-missing", admin.token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ created: before.counts.without, remaining: 0 });

    const after = await get<WalletPage>("/admin/wallets", admin.token);
    expect(after.counts).toMatchObject({ without: 0, with: before.counts.all });

    // Rejouer ne crée rien.
    expect((await send("POST", "/admin/wallets/create-missing", admin.token)).body).toEqual({ created: 0, remaining: 0 });
  });

  it("vue d'ensemble et journal après un crédit puis un achat", async () => {
    let res = await send("PATCH", `/admin/wallets/${coach.userId}/balance`, admin.token, {
      delta: 1000,
      reason: "Lot e2e",
    });
    expect(res.status).toBe(200);
    res = await send("POST", "/dice-themes/orques/purchase", coach.token);
    expect(res.status).toBe(200);

    const overview = await get<any>("/admin/crowns/overview?days=7", admin.token);
    expect(overview.supply).toBe(600);
    expect(overview.wallets).toBe(1);
    expect(overview.usersWithoutWallet).toBeGreaterThanOrEqual(2);
    expect(overview.days).toBe(7);
    expect(overview.flows.recent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "ADMIN_ADJUST", credited: 1000, debited: 0 }),
        expect.objectContaining({ type: "SINK", credited: 0, debited: 400 }),
      ]),
    );
    expect(overview.topHolders[0]).toMatchObject({ userId: coach.userId, crowns: 600 });
    expect(typeof overview.flag.exists).toBe("boolean");

    const ledger = await get<any>("/admin/crowns/transactions?type=SINK", admin.token);
    expect(ledger.total).toBe(1);
    expect(ledger.items[0]).toMatchObject({
      type: "SINK",
      amount: -400,
      ref: "dice-theme:orques",
      user: { id: coach.userId, coachName: "Coach Couronnes" },
    });

    const byCoach = await get<any>("/admin/crowns/transactions?search=Autre", admin.token);
    expect(byCoach.total).toBe(0);
  });

  it("routes réservées aux admins", async () => {
    expect((await rawGet("/admin/wallets", other.token)).status).toBe(403);
    expect((await rawGet("/admin/crowns/overview", null)).status).toBe(401);
    expect((await rawPost(`/admin/wallets/${coach.userId}`, other.token, {})).status).toBe(403);
    expect((await rawPost("/admin/wallets/create-missing", other.token, {})).status).toBe(403);
  });
});
