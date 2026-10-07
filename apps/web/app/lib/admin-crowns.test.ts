import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api-client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "./api-client";
import {
  adminCreateMissingWallets,
  adminCreateWallet,
  adminGetCrownsOverview,
  adminListCrownsLedger,
  adminListWallets,
  crownsFlagState,
  crownsTxTypeLabel,
  parseWalletStatus,
} from "./admin-crowns";

const api = apiRequest as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  api.mockResolvedValue({});
});

describe("wrappers admin des Couronnes", () => {
  it("liste des wallets : query sans les champs vides", async () => {
    await adminListWallets({ status: "without", search: "", page: 2 });
    expect(api).toHaveBeenLastCalledWith("/admin/wallets?status=without&page=2");
    await adminListWallets({});
    expect(api).toHaveBeenLastCalledWith("/admin/wallets");
  });

  it("création unitaire (id échappé) et en masse", async () => {
    await adminCreateWallet("a b");
    expect(api).toHaveBeenLastCalledWith("/admin/wallets/a%20b", { method: "POST" });
    await adminCreateMissingWallets();
    expect(api).toHaveBeenLastCalledWith("/admin/wallets/create-missing", { method: "POST" });
  });

  it("vue d'ensemble et journal", async () => {
    await adminGetCrownsOverview(7);
    expect(api).toHaveBeenLastCalledWith("/admin/crowns/overview?days=7");
    await adminListCrownsLedger({ type: "SINK", page: 1, limit: 50 });
    expect(api).toHaveBeenLastCalledWith("/admin/crowns/transactions?type=SINK&page=1&limit=50");
  });
});

describe("helpers purs", () => {
  it("parseWalletStatus : repli sur « tous »", () => {
    expect(parseWalletStatus("without")).toBe("without");
    expect(parseWalletStatus("with")).toBe("with");
    expect(parseWalletStatus("nope")).toBe("all");
    expect(parseWalletStatus(null)).toBe("all");
  });

  it("crownsFlagState distingue ligne absente, éteint, overrides et actif", () => {
    expect(crownsFlagState({ exists: false, enabled: false, userOverrides: 0 })).toBe("missing");
    expect(crownsFlagState({ exists: true, enabled: false, userOverrides: 0 })).toBe("off");
    expect(crownsFlagState({ exists: true, enabled: false, userOverrides: 3 })).toBe("overrides");
    expect(crownsFlagState({ exists: true, enabled: true, userOverrides: 3 })).toBe("on");
  });

  it("libellé d'un type, repli sur le code", () => {
    expect(crownsTxTypeLabel("SINK")).toBe("Dépense (boutique)");
    // Le type REWARD couvre désormais feuilles, succès et bonus (crowns-earning).
    expect(crownsTxTypeLabel("REWARD")).toBe("Récompenses (jeu, bienvenue)");
    expect(crownsTxTypeLabel("MYSTERY")).toBe("MYSTERY");
  });
});
