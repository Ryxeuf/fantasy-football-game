import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { PairingBonusBreakdown } from "./PairingBonusBreakdown";

// E3 — Tests du détail des points bonus par match.

function renderBreakdown(props: Partial<Parameters<typeof PairingBonusBreakdown>[0]>) {
  render(
    <LanguageProvider>
      <PairingBonusBreakdown
        pairingId="pr1"
        status="played"
        homeName="Alpha"
        awayName="Beta"
        {...props}
      />
    </LanguageProvider>,
  );
}

describe("PairingBonusBreakdown (E3)", () => {
  it("affiche le détail home + away avec libellés et points (breakdown array)", () => {
    renderBreakdown({
      bonusPointsHome: 1,
      bonusPointsAway: 1,
      bonusBreakdown: [
        { ruleId: "r1", label: "3 TD marqués", side: "home", points: 1 },
        { ruleId: "r2", label: "Aucun TD encaissé", side: "away", points: 1 },
      ],
    });
    const home = screen.getByTestId("pairing-bonus-pr1-home");
    expect(home.textContent).toContain("Alpha");
    expect(home.textContent).toContain("+1");
    expect(home.textContent).toContain("3 TD marqués");
    const away = screen.getByTestId("pairing-bonus-pr1-away");
    expect(away.textContent).toContain("Beta");
    expect(away.textContent).toContain("Aucun TD encaissé");
  });

  it("parse un breakdown sérialisé sqlite (string JSON)", () => {
    renderBreakdown({
      bonusPointsHome: 1,
      bonusBreakdown: JSON.stringify([
        { ruleId: "r1", label: "3 sorties infligées", side: "home", points: 1 },
      ]),
    });
    expect(
      screen.getByTestId("pairing-bonus-pr1-home").textContent,
    ).toContain("3 sorties infligées");
  });

  it("affiche les points seuls quand il n'y a pas de breakdown détaillé", () => {
    renderBreakdown({ bonusPointsHome: 2, bonusBreakdown: null });
    const home = screen.getByTestId("pairing-bonus-pr1-home");
    expect(home.textContent).toContain("Alpha");
    expect(home.textContent).toContain("+2");
    expect(home.textContent).not.toContain("(");
    expect(screen.queryByTestId("pairing-bonus-pr1-away")).toBeNull();
  });

  it("ne rend rien quand le pairing n'est pas joué", () => {
    renderBreakdown({
      status: "scheduled",
      bonusPointsHome: 1,
      bonusBreakdown: [{ ruleId: "r1", label: "x", side: "home", points: 1 }],
    });
    expect(screen.queryByTestId("pairing-bonus-pr1")).toBeNull();
  });

  it("ne rend rien quand aucun bonus n'a été appliqué", () => {
    renderBreakdown({ bonusPointsHome: 0, bonusPointsAway: 0, bonusBreakdown: null });
    expect(screen.queryByTestId("pairing-bonus-pr1")).toBeNull();
  });

  it("formate un bonus négatif (malus) avec le signe moins", () => {
    renderBreakdown({ bonusPointsAway: -1, bonusBreakdown: null });
    expect(
      screen.getByTestId("pairing-bonus-pr1-away").textContent,
    ).toContain("-1");
  });
});
