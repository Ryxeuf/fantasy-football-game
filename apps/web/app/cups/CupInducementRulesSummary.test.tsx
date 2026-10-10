import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CupInducementRulesSummary } from "./CupInducementRulesSummary";

describe("CupInducementRulesSummary (fiche de coupe)", () => {
  it("annonce le mode et la liste autorisée, par leurs noms", () => {
    render(<CupInducementRulesSummary mode="build" allowed={["team_mascot", "bribe"]} />);
    expect(screen.getByTestId("cup-inducement-mode-display").textContent).toMatch(
      /À la création de l'équipe/,
    );
    const list = screen.getByTestId("cup-allowed-inducements-display").textContent ?? "";
    expect(list).toMatch(/Mascotte/);
    expect(list).not.toMatch(/team_mascot/);
  });

  it("sans liste : tout le catalogue, rien de plus à dire", () => {
    render(<CupInducementRulesSummary mode="match" allowed={null} />);
    expect(screen.getByTestId("cup-inducement-mode-display").textContent).toMatch(
      /En avant-match/,
    );
    expect(screen.queryByTestId("cup-allowed-inducements-display")).toBeNull();
  });

  it("`none` n'affiche pas de liste ; un mode inconnu n'affiche rien", () => {
    const { rerender } = render(
      <CupInducementRulesSummary mode="none" allowed={["bribe"]} />,
    );
    expect(screen.getByTestId("cup-inducement-mode-display").textContent).toMatch(/Aucun/);
    expect(screen.queryByTestId("cup-allowed-inducements-display")).toBeNull();
    rerender(<CupInducementRulesSummary mode={undefined} allowed={null} />);
    expect(screen.queryByTestId("cup-inducement-mode-display")).toBeNull();
  });
});
