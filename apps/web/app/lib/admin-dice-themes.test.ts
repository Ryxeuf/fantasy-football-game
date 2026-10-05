import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./api-client", () => ({ apiRequest: vi.fn(async () => ({ themes: [], theme: {} })) }));

import { apiRequest } from "./api-client";
import {
  acquisitionSourceLabel,
  adjustCoachCrowns,
  adminGrantDiceTheme,
  adminListCoachCosmetics,
  adminListDiceThemes,
  adminRevokeDiceTheme,
  adminSetCoachDiceTheme,
  adminUpdateDiceTheme,
} from "./admin-dice-themes";

const api = apiRequest as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => api.mockClear());

describe("lib/admin-dice-themes", () => {
  it("appelle les bonnes routes", async () => {
    await adminListDiceThemes();
    expect(api).toHaveBeenLastCalledWith("/admin/dice-themes");
    await adminUpdateDiceTheme("orques", { enabled: false });
    expect(api).toHaveBeenLastCalledWith("/admin/dice-themes/orques", { method: "PATCH", body: '{"enabled":false}' });
    await adminListCoachCosmetics({ search: "bob", page: 2, limit: 10 });
    expect(api).toHaveBeenLastCalledWith("/admin/coach-cosmetics?search=bob&page=2&limit=10");
    await adminListCoachCosmetics({});
    expect(api).toHaveBeenLastCalledWith("/admin/coach-cosmetics");
    await adminGrantDiceTheme("u 1", "nains");
    expect(api).toHaveBeenLastCalledWith("/admin/coach-cosmetics/u%201/dice-themes/nains", { method: "POST" });
    await adminRevokeDiceTheme("u1", "nains", true);
    expect(api).toHaveBeenLastCalledWith("/admin/coach-cosmetics/u1/dice-themes/nains", {
      method: "DELETE",
      body: '{"refund":true}',
    });
    await adminSetCoachDiceTheme("u1", null);
    expect(api).toHaveBeenLastCalledWith("/admin/coach-cosmetics/u1/dice-theme", { method: "PUT", body: '{"themeId":null}' });
    await adjustCoachCrowns("u1", -50, "Correction");
    expect(api).toHaveBeenLastCalledWith("/admin/wallets/u1/balance", {
      method: "PATCH",
      body: '{"delta":-50,"reason":"Correction"}',
    });
  });

  it("libellés des sources d'acquisition", () => {
    expect(acquisitionSourceLabel("purchase")).toBe("Achat");
    expect(acquisitionSourceLabel("admin_grant")).toBe("Cadeau admin");
    expect(acquisitionSourceLabel("other")).toBe("other");
  });
});
