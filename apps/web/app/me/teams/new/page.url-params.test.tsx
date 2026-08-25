/**
 * Le builder doit refléter `?roster=…&ruleset=…&format=…` dans ses `<select>`,
 * y compris sur un chargement complet (HTML rendu côté serveur puis hydraté) :
 * React 18 ne corrige pas la `value` d'un `<select>` à l'hydratation, d'où
 * l'application des paramètres dans un effet de montage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";


vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn().mockResolvedValue({ roster: { positions: [], specialRules: [] } }),
}));

import NewTeamPage from "./page";
import { LanguageProvider } from "../../../contexts/LanguageContext";

const ROSTERS = [
  { slug: "skaven", name: "Skavens" },
  { slug: "goblin", name: "Gobelins" },
];

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes("builder-rosters")
        ? { rosters: ROSTERS }
        : url.includes("star-players")
          ? { starPlayers: [] }
          : {};
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(payload),
      } as Response);
    }),
  );
});

afterEach(() => {
  window.history.replaceState({}, "", "/me/teams/new");
});

function renderAt(search: string) {
  window.history.replaceState({}, "", `/me/teams/new${search}`);
  return render(
    <LanguageProvider>
      <NewTeamPage />
    </LanguageProvider>,
  );
}

describe("Builder — paramètres d'URL", () => {
  it("présélectionne le roster, l'édition et le format venus de la fiche", async () => {
    renderAt("?roster=goblin&ruleset=season_2&format=sevens");

    await waitFor(() =>
      expect(
        (screen.getByTestId("roster-select") as HTMLSelectElement).value,
      ).toBe("goblin"),
    );
    expect(
      (screen.getByTestId("ruleset-select") as HTMLSelectElement).value,
    ).toBe("season_2");
    expect(
      (screen.getByTestId("format-select") as HTMLSelectElement).value,
    ).toBe("sevens");
  });

  it("retombe sur les défauts sans paramètre d'URL", async () => {
    renderAt("");

    await waitFor(() =>
      expect(
        (screen.getByTestId("roster-select") as HTMLSelectElement).value,
      ).toBe("skaven"),
    );
    expect(
      (screen.getByTestId("ruleset-select") as HTMLSelectElement).value,
    ).toBe("season_3");
    expect(
      (screen.getByTestId("format-select") as HTMLSelectElement).value,
    ).toBe("bb11");
  });

  it("applique le budget imposé par l'URL sans le remplacer par celui du format", async () => {
    renderAt("?roster=goblin&format=sevens&teamValue=750");

    await waitFor(() =>
      expect(
        (screen.getByTestId("team-value-input") as HTMLInputElement).value,
      ).toBe("750"),
    );
  });

  it("ne lit pas l'URL pendant le rendu (sinon l'hydratation fige le défaut)", () => {
    // Garde-fou de non-régression. Relire la query string dans un
    // initialiseur `useState` « marche » en test (jsdom expose `window`) mais
    // pas en production : le HTML est rendu côté serveur SANS `window`, donc
    // sur les valeurs par défaut, et React 18 ne recorrige pas la `value`
    // d'un `<select>` à l'hydratation — le formulaire resterait sur Skaven.
    // Les paramètres doivent donc être appliqués dans un effet de montage.
    const source = readFileSync(
      join(process.cwd(), "app/me/teams/new/page.tsx"),
      "utf-8",
    );
    const reads = source.match(/window\.location\.search/g) ?? [];
    expect(reads).toHaveLength(1);
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*const params = readBuilderParams\(\s*window\.location\.search,?\s*\);/,
    );
  });
});
