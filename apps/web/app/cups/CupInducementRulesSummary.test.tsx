import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CupInducementRulesSummary } from "./CupInducementRulesSummary";

const display = () => screen.getByTestId("cup-allowed-inducements-display").textContent ?? "";

describe("CupInducementRulesSummary (fiche de coupe)", () => {
  it("sans règlement : la liste par ses noms", () => {
    render(<CupInducementRulesSummary mode="build" allowed={["team_mascot", "bribe"]} />);
    expect(screen.getByTestId("cup-inducement-mode-display").textContent).toMatch(
      /À la création de l'équipe/,
    );
    expect(display()).toMatch(/limités à .*Mascotte/);
    expect(display()).not.toMatch(/team_mascot/);
  });

  it("sans liste ni règlement : tout le catalogue, rien de plus à dire", () => {
    render(<CupInducementRulesSummary mode="match" allowed={null} />);
    expect(screen.getByTestId("cup-inducement-mode-display").textContent).toMatch(
      /En avant-match/,
    );
    expect(screen.queryByTestId("cup-allowed-inducements-display")).toBeNull();
  });

  it("sous règlement sans liste : la liste du règlement", () => {
    render(
      <CupInducementRulesSummary
        mode="build"
        allowed={null}
        packSlugs={["team_mascot", "bribe"]}
        rulesetLabel="NAF WC 2027"
      />,
    );
    expect(display()).toBe(" — liste du règlement NAF WC 2027");
  });

  it("sous règlement : annonce ajouts et retraits", () => {
    render(
      <CupInducementRulesSummary
        mode="build"
        allowed={["team_mascot", "weather_mage"]}
        packSlugs={["team_mascot", "bribe"]}
        rulesetLabel="NAF WC 2027"
      />,
    );
    expect(display()).toMatch(/\+ Mage Météo/);
    expect(display()).toMatch(/− Pots-de-vin/);
  });

  it("liste vide : aucun coup de pouce autorisé", () => {
    render(<CupInducementRulesSummary mode="build" allowed={[]} packSlugs={["bribe"]} />);
    expect(display()).toMatch(/aucun coup de pouce autorisé/);
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
