/**
 * Header : l'entrée « Parties Offline » (bureau ET mobile) n'existe que si
 * le flag `offline_match` est actif. Sans lui, aucun lien du menu ne mène à
 * un écran « fonctionnalité désactivée ».
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

import { fetchMyFlags } from "../lib/featureFlags";
import { LanguageProvider } from "../contexts/LanguageContext";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import { NotificationsProvider } from "../contexts/NotificationsContext";
import Header from "./Header";

const mockedFetchMyFlags = fetchMyFlags as unknown as ReturnType<typeof vi.fn>;
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

/** Liens (bureau + mobile) pointant vers le hub des parties offline. */
function offlineLinks(): Element[] {
  return Array.from(document.querySelectorAll('a[href="/local-matches"]'));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ user: { email: "coach@nuffle.fr", roles: ["user"] } }),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Header — entrée « Parties Offline »", () => {
  it("absente tant que le flag `offline_match` est coupé", async () => {
    mockedFetchMyFlags.mockResolvedValue([]);
    renderHeader();
    await waitFor(() => expect(mockedFetchMyFlags).toHaveBeenCalled());
    // Le menu mobile porte les mêmes liens : on l'ouvre pour tout couvrir.
    fireEvent.click(screen.getByLabelText("Menu"));
    await waitFor(() => expect(screen.getByTestId("mobile-nav-my-teams")).toBeTruthy());
    expect(offlineLinks()).toHaveLength(0);
  });

  it("présente dès que le flag est actif", async () => {
    mockedFetchMyFlags.mockResolvedValue(["offline_match"]);
    renderHeader();
    await waitFor(() => expect(offlineLinks().length).toBeGreaterThan(0));
  });

  it("le flag `online_play` seul ne la ramène pas", async () => {
    mockedFetchMyFlags.mockResolvedValue(["online_play"]);
    renderHeader();
    await waitFor(() => expect(screen.getByTestId("nav-play-online")).toBeTruthy());
    expect(offlineLinks()).toHaveLength(0);
  });
});
