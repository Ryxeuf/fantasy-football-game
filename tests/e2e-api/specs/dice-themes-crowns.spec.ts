import { describe, it, expect, beforeEach } from "vitest";
import { get, put, rawGet, rawPost, resetDb } from "../helpers/api";
import { API_BASE } from "../helpers/env";
import { seedAndLogin } from "../helpers/factories";

/**
 * Thèmes de dés + Couronnes, de bout en bout sur une vraie base :
 * crédit admin → achat (débit SINK, acquisition, thème équipé) → double
 * achat refusé → retrait de la vente → révocation remboursée → cadeau admin
 * → choix du thème. Les flags `dice_themes` et `crowns` sont ouverts en CI
 * (`FEATURE_FLAGS_FORCE_ENABLED`).
 */

/**
 * `crowns-earning` : la première lecture de `GET /crowns/me` rattrape les
 * récompenses dues — ici le seul bonus de bienvenue (barème de départ de
 * `crowns-rewards-rules`). Les soldes ci-dessous l'incluent dès qu'une
 * lecture a eu lieu ; un achat seul ne déclenche pas de rattrapage.
 */
const SIGNUP = 250;

interface ThemeOption {
  id: string;
  collection: string;
  priceCrowns: number | null;
  owned: boolean;
  forSale: boolean;
}

interface Preference {
  themeId: string;
  defaultThemeId: string;
  themes: ThemeOption[];
}

interface Crowns {
  balance: number;
  transactions: Array<{ type: string; amount: number; ref: string | null }>;
}

async function send(method: "PATCH" | "DELETE" | "POST", path: string, token: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

describe("E2E API — thèmes de dés et Couronnes", () => {
  let admin: { token: string; userId: string };
  let coach: { token: string; userId: string };

  beforeEach(async () => {
    await resetDb();
    admin = await seedAndLogin("admin-dice@ffa.test", "password-a", "Admin", { role: "admin" });
    coach = await seedAndLogin("coach-dice@ffa.test", "password-c", "Coach Dés");
  });

  it("boutique initiale : dé original équipé, 36 thèmes, solde nul", async () => {
    const pref = await get<Preference>("/dice-themes/me", coach.token);
    expect(pref.themeId).toBe("nuffle");
    expect(pref.themes).toHaveLength(36);
    expect(pref.themes.find((t) => t.id === "nuffle")).toMatchObject({ owned: true, priceCrowns: null });
    expect(pref.themes.find((t) => t.id === "orques")).toMatchObject({ owned: false, forSale: true });

    const crowns = await get<Crowns>("/crowns/me", coach.token);
    expect(crowns.balance).toBe(SIGNUP);
  });

  it("parcours complet : crédit, achat, refus, retrait de la vente, remboursement, cadeau", async () => {
    // Sans Crowns : 402.
    let res = await send("POST", "/dice-themes/orques/purchase", coach.token);
    expect(res.status).toBe(402);
    expect(res.body.code).toBe("insufficient-funds");

    // Crédit admin (route wallet existante, journal ADMIN_ADJUST).
    res = await send("PATCH", `/admin/wallets/${coach.userId}/balance`, admin.token, {
      delta: 1000,
      reason: "Lot e2e",
    });
    expect(res.status).toBe(200);
    expect((await get<Crowns>("/crowns/me", coach.token)).balance).toBe(1000 + SIGNUP);

    // Achat : débit, thème acquis ET équipé.
    res = await send("POST", "/dice-themes/orques/purchase", coach.token);
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(600 + SIGNUP);
    expect(res.body.themeId).toBe("orques");

    // Double achat refusé, solde intact.
    res = await send("POST", "/dice-themes/orques/purchase", coach.token);
    expect(res.status).toBe(409);
    const crowns = await get<Crowns>("/crowns/me", coach.token);
    expect(crowns.balance).toBe(600 + SIGNUP);
    expect(crowns.transactions[0]).toMatchObject({ type: "SINK", amount: -400, ref: "dice-theme:orques" });

    // L'admin voit l'acquisition et la recette.
    const detail = await get<any>(`/admin/coach-cosmetics/${coach.userId}`, admin.token);
    expect(detail.acquisitions).toEqual([
      expect.objectContaining({ themeId: "orques", source: "purchase", priceCrowns: 400 }),
    ]);
    const catalogue = await get<{ themes: any[] }>("/admin/dice-themes", admin.token);
    expect(catalogue.themes.find((t) => t.id === "orques").stats).toMatchObject({
      owners: 1,
      purchases: 1,
      selectedBy: 1,
      revenueCrowns: 400,
    });

    // Retrait de la vente : invisible pour qui ne l'a pas, gardé par l'acheteur.
    res = await send("PATCH", "/admin/dice-themes/glace", admin.token, { enabled: false });
    expect(res.status).toBe(200);
    res = await send("PATCH", "/admin/dice-themes/orques", admin.token, { enabled: false });
    expect(res.status).toBe(200);
    let pref = await get<Preference>("/dice-themes/me", coach.token);
    expect(pref.themes.some((t) => t.id === "glace")).toBe(false);
    expect(pref.themes.find((t) => t.id === "orques")).toMatchObject({ owned: true });
    expect(pref.themeId).toBe("orques");
    res = await send("POST", "/dice-themes/glace/purchase", coach.token);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("theme-not-for-sale");

    // Le défaut ne se retire pas.
    res = await send("PATCH", "/admin/dice-themes/nuffle", admin.token, { enabled: false });
    expect(res.status).toBe(409);

    // Révocation remboursée : Crowns rendues, préférence remise au défaut.
    res = await send("DELETE", `/admin/coach-cosmetics/${coach.userId}/dice-themes/orques`, admin.token, {
      refund: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.refunded).toBe(400);
    expect((await get<Crowns>("/crowns/me", coach.token)).balance).toBe(1000 + SIGNUP);
    pref = await get<Preference>("/dice-themes/me", coach.token);
    expect(pref.themeId).toBe("nuffle");

    // Cadeau admin, puis choix par le coach.
    res = await send("POST", `/admin/coach-cosmetics/${coach.userId}/dice-themes/nains`, admin.token);
    expect(res.status).toBe(200);
    pref = await put<Preference>("/dice-themes/me", coach.token, { themeId: "nains" });
    expect(pref.themeId).toBe("nains");
    expect((await get<Crowns>("/crowns/me", coach.token)).balance).toBe(1000 + SIGNUP);
  });

  it("deux achats simultanés ne font jamais passer le solde sous zéro", async () => {
    await send("PATCH", `/admin/wallets/${coach.userId}/balance`, admin.token, {
      delta: 600,
      reason: "Lot e2e",
    });
    const results = await Promise.all([
      send("POST", "/dice-themes/orques/purchase", coach.token),
      send("POST", "/dice-themes/nains/purchase", coach.token),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 402]);
    // Aucune lecture avant les achats : le bonus arrive à celle-ci.
    const crowns = await get<Crowns>("/crowns/me", coach.token);
    expect(crowns.balance).toBe(200 + SIGNUP);
    expect(crowns.transactions.filter((t) => t.type === "SINK")).toHaveLength(1);
  });

  it("un payant non acquis ne se choisit pas", async () => {
    const res = await fetch(`${API_BASE}/dice-themes/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${coach.token}` },
      body: JSON.stringify({ themeId: "orques" }),
    });
    expect(res.status).toBe(403);
  });

  it("routes admin réservées aux admins", async () => {
    expect((await rawGet("/admin/dice-themes", coach.token)).status).toBe(403);
    expect((await rawGet("/admin/coach-cosmetics", null)).status).toBe(401);
    expect(
      (await rawPost(`/admin/coach-cosmetics/${coach.userId}/dice-themes/nains`, coach.token, {})).status,
    ).toBe(403);
  });

  it("liste admin des coachs : recherche par nom de coach", async () => {
    const page = await get<{ items: Array<{ id: string; crowns: number }>; total: number }>(
      "/admin/coach-cosmetics?search=Coach%20D",
      admin.token,
    );
    expect(page.items.map((u) => u.id)).toContain(coach.userId);
  });
});
