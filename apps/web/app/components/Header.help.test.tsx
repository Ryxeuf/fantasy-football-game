/**
 * Header : la page d'aide (`/aide`, toutes les fonctionnalités du site) est
 * accessible depuis le menu Compendium, au bureau comme sur mobile, sans
 * dépendre d'aucun flag.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

vi.mock("../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn().mockResolvedValue([]),
}));
vi.mock("../lib/auth-cookie", () => ({
  syncAuthCookie: vi.fn().mockResolvedValue(true),
  clearAuthCookie: vi.fn().mockResolvedValue(true),
}));
vi.mock("../lib/auth-refresh", () => ({
  refreshAccessToken: vi.fn().mockResolvedValue(null),
}));
vi.mock("../lib/api-client", () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
}));

import { LanguageProvider } from "../contexts/LanguageContext";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import { NotificationsProvider } from "../contexts/NotificationsContext";
import Header from "./Header";

const fetchMock = vi.fn();

function renderHeader() {
  return render(
    <LanguageProvider>
      <FeatureFlagProvider>
        <NotificationsProvider>
          <Header />
        </NotificationsProvider>
      </FeatureFlagProvider>
    </LanguageProvider>,
  );
}

const helpLinks = () => Array.from(document.querySelectorAll('a[href="/aide"]'));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ user: null }),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Header — lien vers l'aide du site", () => {
  it("figure dans le menu Compendium du bureau", async () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: /Compendium/ }));
    await waitFor(() => expect(helpLinks()).toHaveLength(1));
    expect(helpLinks()[0].textContent).toContain("Aide du site");
  });

  it("figure dans le menu mobile", async () => {
    renderHeader();
    fireEvent.click(screen.getByLabelText("Menu"));
    await waitFor(() => expect(screen.getByTestId("mobile-nav-help")).toBeTruthy());
    expect(screen.getByTestId("mobile-nav-help").getAttribute("href")).toBe("/aide");
  });
});
