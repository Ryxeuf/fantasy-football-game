/**
 * Carte de rencontre partagée (ligue / coupe) : score central, vainqueur
 * mis en avant, exempt, mise en avant « mon match » et rendu du nom
 * délégué (lien roster).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MatchCard, { winnerFromScoreLabel } from "./MatchCard";

const home = {
  name: "Reikland Reavers",
  roster: "human",
  coachName: "Griff",
  testId: "team-home",
  coachTestId: "coach-home",
};
const away = { name: "Skavenblight", roster: "skaven", testId: "team-away" };

describe("winnerFromScoreLabel", () => {
  it("lit un score « a – b »", () => {
    expect(winnerFromScoreLabel("2 – 1")).toBe("home");
    expect(winnerFromScoreLabel("0-3")).toBe("away");
    expect(winnerFromScoreLabel("1 – 1")).toBe("draw");
  });
  it("ignore ce qui n'est pas un score", () => {
    expect(winnerFromScoreLabel(null)).toBeNull();
    expect(winnerFromScoreLabel("VS")).toBeNull();
  });
});

describe("MatchCard", () => {
  it("affiche VS et le statut pour une rencontre à venir", () => {
    render(
      <ul>
        <MatchCard
          home={home}
          away={away}
          testId="card"
          scoreTestId="score"
          status={{ label: "À jouer", tone: "neutral", testId: "status" }}
        />
      </ul>,
    );
    expect(screen.getByTestId("score").textContent).toBe("VS");
    expect(screen.getByTestId("status").textContent).toBe("À jouer");
    expect(screen.getByTestId("team-home").getAttribute("data-emphasis")).toBe("neutral");
    expect(screen.getByTestId("coach-home").textContent).toBe("Griff");
    expect(screen.queryByTestId("card-mine")).toBeNull();
  });

  it("met le vainqueur en avant et estompe le perdant", () => {
    render(
      <ul>
        <MatchCard home={home} away={away} scoreLabel="3 – 1" scoreTestId="score" />
      </ul>,
    );
    expect(screen.getByTestId("score").textContent).toBe("3 – 1");
    expect(screen.getByTestId("team-home").getAttribute("data-emphasis")).toBe("winner");
    expect(screen.getByTestId("team-away").getAttribute("data-emphasis")).toBe("loser");
  });

  it("signale la rencontre du coach connecté", () => {
    render(
      <ul>
        <MatchCard home={home} away={away} testId="card" highlighted highlightLabel="Mon match" />
      </ul>,
    );
    expect(screen.getByTestId("card-mine").textContent).toBe("Mon match");
    expect(screen.getByTestId("card").getAttribute("data-highlighted")).toBe("true");
  });

  it("rend une équipe exemptée sans adversaire", () => {
    render(
      <ul>
        <MatchCard home={home} away={null} byeLabel="Exempt" testId="card" />
      </ul>,
    );
    expect(screen.getByTestId("card-bye").textContent).toBe("Exempt");
    expect(screen.queryByTestId("team-away")).toBeNull();
  });

  it("délègue le rendu du nom (lien roster)", () => {
    render(
      <ul>
        <MatchCard
          home={{
            ...home,
            renderName: (name) => (
              <a href="/roster" data-testid="roster-link">
                {name}
              </a>
            ),
          }}
          away={away}
        />
      </ul>,
    );
    expect(screen.getByTestId("roster-link").textContent).toContain("Reikland Reavers");
  });
});
