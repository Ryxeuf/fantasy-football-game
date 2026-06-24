import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { LeagueForm, type LeagueFormValues } from "./LeagueForm";

// E1 — Tests de l'editeur de points bonus integre a LeagueForm. Le form
// charge la liste des rosters au montage (apiRequest -> global.fetch) ;
// on stub un fetch vide + un token localStorage pour eviter les erreurs.

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn<(key: string) => string | null>(() => "test-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

async function renderForm(initialValues?: Partial<LeagueFormValues>) {
  const onSubmit = vi.fn<(values: LeagueFormValues) => void>();
  render(
    <LanguageProvider>
      <LeagueForm
        mode="create"
        submitting={false}
        error={null}
        cancelHref="/leagues"
        initialValues={{ name: "My League", ...initialValues }}
        onSubmit={onSubmit}
      />
    </LanguageProvider>,
  );
  // Laisse l'effet de chargement des rosters (fetch) se resoudre dans
  // act() avant les interactions synchrones.
  await screen.findByTestId("league-form-bonus");
  return { onSubmit };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReturnValue("test-token");
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ rosters: [] }),
  });
});

describe("LeagueForm — editeur de points bonus (E1)", () => {
  it("affiche la section bonus vide par defaut", async () => {
    await renderForm();
    expect(screen.getByTestId("league-form-bonus")).toBeTruthy();
    expect(screen.getByTestId("bonus-empty")).toBeTruthy();
    expect(screen.queryByTestId("bonus-rule-0")).toBeNull();
  });

  it("ajoute une regle via un preset (3 TD marques)", async () => {
    await renderForm();
    fireEvent.click(screen.getByTestId("bonus-preset-3tds"));
    expect(screen.queryByTestId("bonus-empty")).toBeNull();
    const cond = screen.getByTestId("bonus-rule-0-condition") as HTMLSelectElement;
    expect(cond.value).toBe("tds_scored_gte");
    const value = screen.getByTestId("bonus-rule-0-value") as HTMLInputElement;
    expect(value.value).toBe("3");
  });

  it("un preset booleen (clean sheet) n'affiche pas de champ seuil", async () => {
    await renderForm();
    fireEvent.click(screen.getByTestId("bonus-preset-cleanSheet"));
    const cond = screen.getByTestId("bonus-rule-0-condition") as HTMLSelectElement;
    expect(cond.value).toBe("clean_sheet");
    expect(screen.queryByTestId("bonus-rule-0-value")).toBeNull();
  });

  it("ajoute une regle personnalisee puis masque le seuil en passant a une condition booleenne", async () => {
    await renderForm();
    fireEvent.click(screen.getByTestId("bonus-add-custom"));
    expect(screen.getByTestId("bonus-rule-0-value")).toBeTruthy();
    fireEvent.change(screen.getByTestId("bonus-rule-0-condition"), {
      target: { value: "clean_sheet" },
    });
    expect(screen.queryByTestId("bonus-rule-0-value")).toBeNull();
  });

  it("retire la bonne regle", async () => {
    await renderForm();
    fireEvent.click(screen.getByTestId("bonus-preset-3tds"));
    fireEvent.click(screen.getByTestId("bonus-preset-3cas"));
    expect(screen.getByTestId("bonus-rule-1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("bonus-rule-0-remove"));
    expect(screen.queryByTestId("bonus-rule-1")).toBeNull();
    // la regle restante (ex-index 1) est re-indexee en 0
    const cond = screen.getByTestId("bonus-rule-0-condition") as HTMLSelectElement;
    expect(cond.value).toBe("cas_inflicted_gte");
  });

  it("transmet les regles bonus dans onSubmit", async () => {
    const { onSubmit } = await renderForm();
    fireEvent.click(screen.getByTestId("bonus-preset-3tds"));
    fireEvent.click(screen.getByTestId("league-form-submit"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0][0];
    expect(values.bonusPointsConfig).toHaveLength(1);
    expect(values.bonusPointsConfig[0].condition.type).toBe("tds_scored_gte");
    expect(values.bonusPointsConfig[0].appliesTo).toBe("both");
  });

  it("hydrate les regles depuis initialValues (round-trip edition)", async () => {
    await renderForm({
      bonusPointsConfig: [
        {
          id: "r1",
          label: "3 TD",
          condition: { type: "tds_scored_gte", value: 3 },
          points: 1,
          appliesTo: "both",
        },
      ],
    });
    expect(screen.getByTestId("bonus-rule-0")).toBeTruthy();
    const cond = screen.getByTestId("bonus-rule-0-condition") as HTMLSelectElement;
    expect(cond.value).toBe("tds_scored_gte");
    expect(screen.queryByTestId("bonus-empty")).toBeNull();
  });
});
