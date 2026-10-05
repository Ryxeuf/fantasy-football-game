import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

vi.mock("../lib/api-client", () => ({ apiRequest: vi.fn() }));
const { flags } = vi.hoisted(() => ({ flags: { keys: [] as string[] } }));
vi.mock("../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn(async () => flags.keys),
}));

import { apiRequest } from "../lib/api-client";
import { FeatureFlagProvider } from "./FeatureFlagContext";
import { DiceThemeProvider, useDiceTheme, type DiceThemeContextValue } from "./DiceThemeContext";
import { DICE_THEMES_FLAG } from "../lib/featureFlagKeys";
import { useDiceSkin } from "@bb/ui/dice";

const mockedApi = apiRequest as unknown as ReturnType<typeof vi.fn>;

let captured: DiceThemeContextValue | null = null;
function Probe() {
  captured = useDiceTheme();
  return <span data-testid="theme">{`${captured.enabled}:${captured.themeId}`}</span>;
}

function renderWithProviders() {
  return render(
    <FeatureFlagProvider>
      <DiceThemeProvider>
        <Probe />
      </DiceThemeProvider>
    </FeatureFlagProvider>,
  );
}

function option(id: string, owned: boolean, priceCrowns: number | null = null) {
  return {
    id,
    collection: "classic",
    name: { fr: id, en: id },
    description: { fr: "d", en: "d" },
    priceCrowns,
    owned,
    forSale: !owned && priceCrowns !== null,
  };
}

const PREF = {
  themeId: "nuffle",
  defaultThemeId: "nuffle",
  themes: [option("nuffle", true), option("orques", false, 400)],
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("DiceThemeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.mockReset();
    captured = null;
    window.localStorage.clear();
    window.localStorage.setItem("auth_token", "tok");
    flags.keys = [DICE_THEMES_FLAG];
  });

  it("hors provider : thème par défaut, sélection no-op", async () => {
    render(<Probe />);
    expect(screen.getByTestId("theme").textContent).toBe("false:nuffle");
    await captured!.selectTheme("nuffle");
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("flag OFF : thème par défaut, AUCUNE requête", async () => {
    flags.keys = [];
    renderWithProviders();
    await flush();
    expect(screen.getByTestId("theme").textContent).toBe("false:nuffle");
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("flag ON mais visiteur anonyme : aucune requête", async () => {
    window.localStorage.clear();
    renderWithProviders();
    await flush();
    expect(screen.getByTestId("theme").textContent).toBe("true:nuffle");
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("flag ON + connecté : charge la préférence du coach", async () => {
    mockedApi.mockResolvedValue(PREF);
    renderWithProviders();
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith("/dice-themes/me"));
    await waitFor(() => expect(captured!.ownedThemeIds.has("nuffle")).toBe(true));
    expect(screen.getByTestId("theme").textContent).toBe("true:nuffle");
  });

  it("un thème servi mais inconnu du web retombe sur le rendu par défaut", async () => {
    mockedApi.mockResolvedValue({ ...PREF, themeId: "from-the-future" });
    renderWithProviders();
    await waitFor(() => expect(mockedApi).toHaveBeenCalled());
    await flush();
    expect(screen.getByTestId("theme").textContent).toBe("true:nuffle");
    expect(captured!.renderer.id).toBe("nuffle");
  });

  it("erreur réseau : thème par défaut", async () => {
    mockedApi.mockRejectedValue(new Error("boom"));
    renderWithProviders();
    await waitFor(() => expect(mockedApi).toHaveBeenCalled());
    await flush();
    expect(screen.getByTestId("theme").textContent).toBe("true:nuffle");
  });

  it("selectTheme envoie un PUT et applique la réponse", async () => {
    mockedApi.mockResolvedValue(PREF);
    renderWithProviders();
    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(1));
    await act(async () => {
      await captured!.selectTheme("nuffle");
    });
    expect(mockedApi).toHaveBeenLastCalledWith("/dice-themes/me", {
      method: "PUT",
      body: JSON.stringify({ themeId: "nuffle" }),
    });
  });

  it("sert la boutique et la possession du serveur", async () => {
    mockedApi.mockResolvedValue(PREF);
    renderWithProviders();
    await waitFor(() => expect(captured!.themes).toHaveLength(2));
    expect(captured!.ownedThemeIds.has("orques")).toBe(false);
  });

  it("purchaseTheme : POST, applique la préférence, renvoie le solde", async () => {
    mockedApi.mockResolvedValueOnce(PREF).mockResolvedValueOnce({
      ...PREF,
      themeId: "orques",
      themes: [option("nuffle", true), option("orques", true, 400)],
      balance: 600,
    });
    renderWithProviders();
    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(1));
    let balance = 0;
    await act(async () => {
      balance = await captured!.purchaseTheme("orques");
    });
    expect(balance).toBe(600);
    expect(mockedApi).toHaveBeenLastCalledWith("/dice-themes/orques/purchase", { method: "POST" });
    expect(screen.getByTestId("theme").textContent).toBe("true:orques");
    expect(captured!.renderer.id).toBe("orques");
  });

  it("le thème du coach habille aussi les dés de @bb/ui (skin)", async () => {
    mockedApi.mockResolvedValue({ ...PREF, themeId: "orques", themes: [option("nuffle", true), option("orques", true, 400)] });
    function SkinProbe() {
      return <span data-testid="skin">{useDiceSkin().id}</span>;
    }
    render(
      <FeatureFlagProvider>
        <DiceThemeProvider>
          <SkinProbe />
        </DiceThemeProvider>
      </FeatureFlagProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("skin").textContent).toBe("orques"));
  });
});
