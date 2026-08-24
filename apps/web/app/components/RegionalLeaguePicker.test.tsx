/**
 * Sélecteur de Ligue régionale : trois formes selon le nombre d'options.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RegionalLeaguePicker from "./RegionalLeaguePicker";
import { LanguageProvider } from "../contexts/LanguageContext";

const NORSE_OPTIONS = [
  { slug: "old_world_classic", name: "Classique du Vieux Monde", grants: [], grantLabels: [] },
  {
    slug: "chaos_clash",
    name: "Clash du Chaos",
    grants: ["favoured_of_khorne"],
    grantLabels: ["Favori de Khorne"],
  },
];

function renderPicker(props: Partial<Parameters<typeof RegionalLeaguePicker>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <LanguageProvider>
      <RegionalLeaguePicker
        options={NORSE_OPTIONS}
        value={null}
        onChange={onChange}
        {...props}
      />
    </LanguageProvider>,
  );
  return { onChange };
}

afterEach(() => {
  localStorage.clear();
});

describe("RegionalLeaguePicker", () => {
  it("n'affiche rien sans option", () => {
    const { container } = render(
      <LanguageProvider>
        <RegionalLeaguePicker options={[]} value={null} onChange={vi.fn()} />
      </LanguageProvider>,
    );
    expect(container.querySelector("[data-testid]")).toBeNull();
  });

  it("informe sans rien demander quand la Ligue est imposée", () => {
    render(
      <LanguageProvider>
        <RegionalLeaguePicker
          options={[{ slug: "badlands_brawl", name: "Bagarre des Terres Arides" }]}
          value="badlands_brawl"
          onChange={vi.fn()}
        />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("regional-league-imposed")).toBeTruthy();
    expect(screen.queryByTestId("regional-league-picker")).toBeNull();
  });

  it("propose un choix et remonte la sélection", () => {
    const { onChange } = renderPicker();

    fireEvent.click(screen.getByTestId("regional-league-option-chaos_clash"));

    expect(onChange).toHaveBeenCalledWith("chaos_clash");
  });

  it("annonce ce que la Ligue apporte en plus", () => {
    renderPicker();
    expect(screen.getByText(/Favori de Khorne/)).toBeTruthy();
  });

  it("signale le choix manquant après une tentative de création", () => {
    renderPicker({ showRequiredHint: true });
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("ne crie pas tant que le coach n'a rien tenté", () => {
    renderPicker({ showRequiredHint: false });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
