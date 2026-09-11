/**
 * Gate de la brique « partie offline » : sans le flag `offline_match`, aucun
 * écran de /local-matches ne s'affiche — et le repli dit où saisir un
 * résultat (la feuille de match) plutôt que de renvoyer sèchement à
 * l'accueil.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn(),
}));

import { fetchMyFlags } from "../lib/featureFlags";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { OfflineMatchGate } from "./OfflineMatchGate";

const mockedFetchMyFlags = fetchMyFlags as unknown as ReturnType<typeof vi.fn>;

function Inside() {
  return <div data-testid="inside">OFFLINE MATCH CONTENT</div>;
}

function renderGate(children: ReactNode) {
  return render(
    <LanguageProvider>
      <FeatureFlagProvider>{children}</FeatureFlagProvider>
    </LanguageProvider>,
  );
}

describe("OfflineMatchGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("auth_token", "fake-token");
  });

  it("rend le contenu quand le flag `offline_match` est actif", async () => {
    mockedFetchMyFlags.mockResolvedValue(["offline_match"]);
    renderGate(
      <OfflineMatchGate>
        <Inside />
      </OfflineMatchGate>,
    );
    await waitFor(() => expect(screen.getByTestId("inside")).toBeTruthy());
  });

  it("affiche l'écran « désactivée » quand le flag est absent", async () => {
    mockedFetchMyFlags.mockResolvedValue([]);
    renderGate(
      <OfflineMatchGate>
        <Inside />
      </OfflineMatchGate>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("offline-match-gate-disabled")).toBeTruthy(),
    );
    expect(screen.queryByTestId("inside")).toBeNull();
    // Le repli oriente vers le chemin de saisie qui reste ouvert.
    expect(
      screen.getByTestId("offline-match-gate-leagues").getAttribute("href"),
    ).toBe("/leagues");
  });

  it("n'est pas déverrouillé par les autres flags", async () => {
    mockedFetchMyFlags.mockResolvedValue(["online_play", "league"]);
    renderGate(
      <OfflineMatchGate>
        <Inside />
      </OfflineMatchGate>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("offline-match-gate-disabled")).toBeTruthy(),
    );
  });
});
