import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ScoringSystemPanel } from "./ScoringSystemPanel";
import { LanguageProvider } from "../../contexts/LanguageContext";

const BAREME = {
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
};

function renderPanel(props: Partial<Parameters<typeof ScoringSystemPanel>[0]>) {
  return render(
    <LanguageProvider>
      <ScoringSystemPanel {...BAREME} {...props} />
    </LanguageProvider>,
  );
}

describe("ScoringSystemPanel", () => {
  it("affiche le barème victoire / nul / défaite / forfait", () => {
    renderPanel({});
    const panel = screen.getByTestId("league-scoring-config");
    expect(within(panel).getByTestId("league-score-win").textContent).toContain(
      "3",
    );
    expect(within(panel).getByTestId("league-score-draw").textContent).toContain(
      "1",
    );
    expect(within(panel).getByTestId("league-score-loss").textContent).toContain(
      "0",
    );
    expect(
      within(panel).getByTestId("league-score-forfeit").textContent,
    ).toContain("-1");
  });

  it("n'affiche aucun bloc bonus quand la ligue n'en a pas", () => {
    renderPanel({ bonusPointsConfig: null });
    expect(screen.queryByTestId("league-bonus-rules")).toBeNull();
  });

  it("liste les règles de bonus avec points, condition et destinataire", () => {
    renderPanel({
      bonusPointsConfig: [
        {
          id: "b1",
          label: "Machine à TD",
          condition: { type: "tds_scored_gte", value: 3 },
          points: 1,
          appliesTo: "both",
        },
      ],
    });
    const rule = screen.getByTestId("league-bonus-rule-b1");
    expect(rule.textContent).toContain("+1");
    expect(rule.textContent).toContain("Machine à TD");
    expect(rule.textContent).toContain("TD marqués ≥ 3");
    expect(rule.textContent).toContain("Les deux équipes");
  });

  it("omet le seuil des conditions booléennes", () => {
    renderPanel({
      bonusPointsConfig: [
        {
          id: "b2",
          label: "Muraille",
          condition: { type: "clean_sheet" },
          points: 2,
          appliesTo: "winner",
        },
      ],
    });
    const rule = screen.getByTestId("league-bonus-rule-b2");
    expect(rule.textContent).toContain("Aucun TD encaissé");
    expect(rule.textContent).not.toMatch(/≥|≤/);
    expect(rule.textContent).toContain("Vainqueur");
  });

  it("lit un bonusPointsConfig sérialisé (miroir sqlite)", () => {
    renderPanel({
      bonusPointsConfig: JSON.stringify([
        {
          id: "b3",
          label: "Boucherie",
          condition: { type: "cas_inflicted_gte", value: 3 },
          points: 1,
          appliesTo: "both",
        },
      ]),
    });
    expect(screen.getByTestId("league-bonus-rule-b3").textContent).toContain(
      "Boucherie",
    );
  });

  it("ignore un bonusPointsConfig malformé sans casser l'affichage", () => {
    renderPanel({ bonusPointsConfig: "{pas du json" });
    expect(screen.getByTestId("league-scoring-config")).toBeTruthy();
    expect(screen.queryByTestId("league-bonus-rules")).toBeNull();
  });
});
