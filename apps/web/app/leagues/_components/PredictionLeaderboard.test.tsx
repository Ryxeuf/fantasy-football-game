import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PredictionLeaderboard } from "./PredictionLeaderboard";
import { makeBoard, makeEntry } from "./predictions.fixtures";

describe("PredictionLeaderboard", () => {
  it("deux onglets, Coachs ouvert par défaut", () => {
    render(
      <PredictionLeaderboard
        board={makeBoard({
          coach: [makeEntry({ userId: "c1", displayName: "Alice" })],
          stands: [
            makeEntry({ userId: "s1", displayName: "Fan", group: "stands" }),
          ],
        })}
      />,
    );
    expect(screen.getByTestId("prediction-board-tab-coach").textContent).toBe(
      "Coachs (1)",
    );
    expect(screen.getByTestId("prediction-board-row-c1")).toBeTruthy();
    expect(screen.queryByTestId("prediction-board-row-s1")).toBeNull();

    fireEvent.click(screen.getByTestId("prediction-board-tab-stands"));
    expect(screen.getByTestId("prediction-board-row-s1")).toBeTruthy();
    expect(screen.queryByTestId("prediction-board-row-c1")).toBeNull();
  });

  it("ouvre l'onglet demandé (celui du lecteur)", () => {
    render(
      <PredictionLeaderboard
        board={makeBoard({ coach: [], stands: [] })}
        initialTab="stands"
      />,
    );
    expect(
      screen.getByTestId("prediction-board-tab-stands").getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    expect(screen.getByTestId("prediction-board-empty-stands")).toBeTruthy();
  });

  it("résumé : le haut du classement, plus la ligne du lecteur", () => {
    const coach = [1, 2, 3, 4, 5].map((rank) =>
      makeEntry({
        rank,
        userId: `c${rank}`,
        displayName: `Coach ${rank}`,
        points: 10 - rank,
        isViewer: rank === 5,
      }),
    );
    render(<PredictionLeaderboard board={makeBoard({ coach })} limit={3} />);
    expect(screen.getByTestId("prediction-board-row-c3")).toBeTruthy();
    expect(screen.queryByTestId("prediction-board-row-c4")).toBeNull();
    expect(screen.getByTestId("prediction-board-row-c5")).toBeTruthy();
  });

  it("affiche points, justes/réglés et exacts", () => {
    render(
      <PredictionLeaderboard
        board={makeBoard({
          coach: [
            makeEntry({ userId: "c1", points: 8, correct: 2, settled: 3, exact: 1 }),
          ],
        })}
      />,
    );
    const row = screen.getByTestId("prediction-board-row-c1");
    expect(row.textContent).toContain("8");
    expect(row.textContent).toContain("2/3");
  });
});
