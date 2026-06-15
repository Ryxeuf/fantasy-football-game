/**
 * Tests AuthRefreshLoop — refresh proactif au montage.
 *
 * Régression : l'interval seul (13 min) ne rafraîchit pas un access token
 * DÉJÀ expiré au chargement (retour sur le site / après un build). On vérifie
 * que le composant déclenche un refresh immédiat quand le token est périmé.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("../lib/auth-refresh", () => ({
  refreshAccessToken: vi.fn(),
}));
vi.mock("../lib/auth-storage", () => ({
  getRefreshToken: vi.fn(),
  isAccessTokenExpired: vi.fn(),
}));

import { refreshAccessToken } from "../lib/auth-refresh";
import { getRefreshToken, isAccessTokenExpired } from "../lib/auth-storage";
import AuthRefreshLoop from "./AuthRefreshLoop";

const mockRefresh = refreshAccessToken as unknown as ReturnType<typeof vi.fn>;
const mockGetRefresh = getRefreshToken as unknown as ReturnType<typeof vi.fn>;
const mockExpired = isAccessTokenExpired as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AuthRefreshLoop", () => {
  it("does nothing when there is no refresh token", () => {
    mockGetRefresh.mockReturnValue(null);
    render(<AuthRefreshLoop />);
    expect(mockRefresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(13 * 60 * 1000);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("refreshes immediately on mount when the access token is expired", () => {
    mockGetRefresh.mockReturnValue("valid-refresh");
    mockExpired.mockReturnValue(true);
    render(<AuthRefreshLoop />);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("does NOT refresh on mount when the access token is still valid", () => {
    mockGetRefresh.mockReturnValue("valid-refresh");
    mockExpired.mockReturnValue(false);
    render(<AuthRefreshLoop />);
    expect(mockRefresh).not.toHaveBeenCalled();

    // ... mais l'interval finit par rafraîchir (keep-alive).
    vi.advanceTimersByTime(13 * 60 * 1000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
