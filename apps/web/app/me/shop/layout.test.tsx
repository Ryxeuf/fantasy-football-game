import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { state } = vi.hoisted(() => ({
  state: {
    flags: null as null | { flags: Set<string>; loading: boolean },
    pathname: "/me/shop/dice-themes",
    crowns: {} as Record<string, unknown>,
  },
}));

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("../../contexts/FeatureFlagContext", () => ({
  useOptionalFeatureFlagContext: () => state.flags,
}));
vi.mock("../../contexts/CrownsContext", () => ({
  useCrowns: () => state.crowns,
}));

import ShopLayout from "./layout";

beforeEach(() => {
  state.flags = { flags: new Set(["dice_themes", "crowns"]), loading: false };
  state.pathname = "/me/shop/dice-themes";
  state.crowns = {
    enabled: true,
    balance: 1250,
    schedule: { sheet: 25, achievement: 50, signup: 250, seasonSheetCap: 500 },
  };
});

describe("ShopLayout", () => {
  it("titre Boutique, solde et onglet de la catégorie active", () => {
    render(
      <ShopLayout>
        <p>contenu</p>
      </ShopLayout>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Boutique");
    expect(screen.getByTestId("crowns-balance").textContent?.replace(/\s/g, " ")).toContain("1 250");
    const tab = screen.getByTestId("shop-category-dice-themes");
    expect(tab.getAttribute("href")).toBe("/me/shop/dice-themes");
    expect(tab.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("contenu")).toBeTruthy();
  });

  it("Couronnes ouvertes : explique comment en gagner (barème servi)", () => {
    render(
      <ShopLayout>
        <p>contenu</p>
      </ShopLayout>,
    );
    expect(screen.getByTestId("crowns-how-to-earn").textContent).toContain("+25 par coach");
  });

  it("Couronnes fermées : pas d'explication des gains", () => {
    state.crowns = { enabled: false, balance: null };
    render(
      <ShopLayout>
        <p>contenu</p>
      </ShopLayout>,
    );
    expect(screen.queryByTestId("crowns-how-to-earn")).toBeNull();
  });

  it("aucune catégorie ouverte : boutique fermée, contenu non rendu", () => {
    state.flags = { flags: new Set(), loading: false };
    render(
      <ShopLayout>
        <p>contenu</p>
      </ShopLayout>,
    );
    expect(screen.getByTestId("shop-closed")).toBeTruthy();
    expect(screen.queryByText("contenu")).toBeNull();
  });

  it("flags en chargement : jamais « fermée »", () => {
    state.flags = { flags: new Set(), loading: true };
    render(
      <ShopLayout>
        <p>contenu</p>
      </ShopLayout>,
    );
    expect(screen.getByTestId("shop-loading")).toBeTruthy();
    expect(screen.queryByTestId("shop-closed")).toBeNull();
  });

  it("hors FeatureFlagProvider : fermée", () => {
    state.flags = null;
    render(
      <ShopLayout>
        <p>contenu</p>
      </ShopLayout>,
    );
    expect(screen.getByTestId("shop-closed")).toBeTruthy();
  });
});
