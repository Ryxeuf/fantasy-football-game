/**
 * Header : la cloche de notifications (bureau + mobile) n'apparaît que pour
 * un coach connecté, avec le compteur du contexte.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

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
  apiRequest: vi.fn(),
}));

import { apiRequest } from "../lib/api-client";
import { LanguageProvider } from "../contexts/LanguageContext";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import { NotificationsProvider } from "../contexts/NotificationsContext";
import Header from "./Header";

const mockApi = apiRequest as unknown as ReturnType<typeof vi.fn>;
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

describe("Header — cloche de notifications", () => {
  it("absente pour un visiteur déconnecté", async () => {
    renderHeader();
    await waitFor(() => expect(screen.queryByText(/Connexion|Login/)).toBeTruthy());
    expect(screen.queryByTestId("notifications-bell")).toBeNull();
    expect(screen.queryByTestId("notifications-bell-mobile")).toBeNull();
  });

  it("présente (bureau + mobile) avec le compteur pour un coach connecté", async () => {
    window.localStorage.setItem("auth_token", "tok");
    mockApi.mockResolvedValue({ count: 5 });
    renderHeader();
    const bell = await screen.findByTestId("notifications-bell");
    expect(bell.getAttribute("href")).toBe("/me/notifications");
    expect(screen.getByTestId("notifications-bell-mobile")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByTestId("notifications-unread-badge")[0].textContent).toBe("5"),
    );
  });
});
