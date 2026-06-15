/**
 * Tests AuthBar — état de session après expiration de l'access token.
 *
 * Régression ciblée : après un build/redeploy, l'access token (15 min) est
 * périmé. Avant le fix, AuthBar gardait `hasToken=true` (présence brute en
 * localStorage) et, sur /auth/me 401, ne nullait que userData → menu "connecté
 * fantôme" (libellé générique "Utilisateur", aucun accès). Le fix : tenter un
 * refresh silencieux puis, si la session est réellement perdue, purger les
 * tokens et basculer en "déconnecté".
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("./lib/featureFlags", () => ({
  fetchMyFlags: vi.fn(),
}));
vi.mock("./lib/auth-refresh", () => ({
  refreshAccessToken: vi.fn(),
}));
vi.mock("./lib/auth-cookie", () => ({
  syncAuthCookie: vi.fn().mockResolvedValue(true),
  clearAuthCookie: vi.fn().mockResolvedValue(true),
}));

import { fetchMyFlags } from "./lib/featureFlags";
import { refreshAccessToken } from "./lib/auth-refresh";
import { clearAuthCookie } from "./lib/auth-cookie";
import { LanguageProvider } from "./contexts/LanguageContext";
import { FeatureFlagProvider } from "./contexts/FeatureFlagContext";
import AuthBar from "./AuthBar";

const mockFetchMyFlags = fetchMyFlags as unknown as ReturnType<typeof vi.fn>;
const mockRefresh = refreshAccessToken as unknown as ReturnType<typeof vi.fn>;
const mockClearCookie = clearAuthCookie as unknown as ReturnType<typeof vi.fn>;
const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function renderAuthBar(children: ReactNode = <AuthBar />) {
  return render(
    <LanguageProvider>
      <FeatureFlagProvider>{children}</FeatureFlagProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockFetchMyFlags.mockResolvedValue([]);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(jsonResponse(200, {}));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthBar — session state", () => {
  it("renders the login link when there is no token", async () => {
    const { container } = renderAuthBar();
    await waitFor(() => {
      expect(container.querySelector('a[href="/login"]')).not.toBeNull();
    });
    expect(
      container.querySelector('button[aria-label="Menu utilisateur"]'),
    ).toBeNull();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("shows the user menu when /auth/me succeeds", async () => {
    window.localStorage.setItem("auth_token", "valid-access");
    fetchMock.mockImplementation((url: string) =>
      String(url).includes("/auth/me")
        ? Promise.resolve(
            jsonResponse(200, { user: { email: "coach@nuffle.fr", roles: ["user"] } }),
          )
        : Promise.resolve(jsonResponse(200, {})),
    );

    const { container } = renderAuthBar();

    await waitFor(() => {
      expect(
        container.querySelector('button[aria-label="Menu utilisateur"]'),
      ).not.toBeNull();
    });
    expect(screen.getByText("coach@nuffle.fr")).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("refreshes silently on 401 then shows the user (session recovered)", async () => {
    window.localStorage.setItem("auth_token", "expired-access");
    window.localStorage.setItem("auth_refresh_token", "valid-refresh");
    mockRefresh.mockResolvedValue("fresh-access");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (!String(url).includes("/auth/me")) {
        return Promise.resolve(jsonResponse(200, {}));
      }
      const auth = (init?.headers as Record<string, string> | undefined)
        ?.Authorization;
      if (auth === "Bearer fresh-access") {
        return Promise.resolve(
          jsonResponse(200, { user: { email: "coach@nuffle.fr", roles: ["user"] } }),
        );
      }
      return Promise.resolve(jsonResponse(401, { error: "Token invalide" }));
    });

    const { container } = renderAuthBar();

    await waitFor(() => {
      expect(screen.getByText("coach@nuffle.fr")).toBeTruthy();
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('button[aria-label="Menu utilisateur"]'),
    ).not.toBeNull();
  });

  it("logs out (no phantom menu) when refresh fails on a 401", async () => {
    window.localStorage.setItem("auth_token", "expired-access");
    window.localStorage.setItem("auth_refresh_token", "dead-refresh");
    mockRefresh.mockResolvedValue(null);

    fetchMock.mockImplementation((url: string) =>
      String(url).includes("/auth/me")
        ? Promise.resolve(jsonResponse(401, { error: "Token invalide" }))
        : Promise.resolve(jsonResponse(200, {})),
    );

    const { container } = renderAuthBar();

    // Bascule en "déconnecté" : lien login visible, pas de menu utilisateur.
    await waitFor(() => {
      expect(container.querySelector('a[href="/login"]')).not.toBeNull();
    });
    expect(
      container.querySelector('button[aria-label="Menu utilisateur"]'),
    ).toBeNull();
    // Les tokens périmés ont été purgés + cookie effacé.
    expect(window.localStorage.getItem("auth_token")).toBeNull();
    expect(window.localStorage.getItem("auth_refresh_token")).toBeNull();
    expect(mockClearCookie).toHaveBeenCalled();
  });

  it("keeps the session (no logout) on a transient network error", async () => {
    window.localStorage.setItem("auth_token", "valid-access");
    fetchMock.mockImplementation((url: string) =>
      String(url).includes("/auth/me")
        ? Promise.reject(new Error("network down"))
        : Promise.resolve(jsonResponse(200, {})),
    );

    const { container } = renderAuthBar();

    // Le menu reste affiché (état optimiste), le token n'est PAS purgé.
    await waitFor(() => {
      expect(
        container.querySelector('button[aria-label="Menu utilisateur"]'),
      ).not.toBeNull();
    });
    expect(window.localStorage.getItem("auth_token")).toBe("valid-access");
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
