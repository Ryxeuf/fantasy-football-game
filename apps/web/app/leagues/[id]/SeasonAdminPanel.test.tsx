/**
 * Panneau admin de saison — invitation à clôturer.
 *
 * Aucun résultat ne ferme plus la saison de lui-même (le dernier match
 * doit rester invalidable) : quand toutes les journées sont jouées, le
 * panneau doit le dire au commissaire et mettre le bouton « Clôturer »
 * en avant.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeasonAdminPanel } from "./SeasonAdminPanel";
import { LanguageProvider } from "../../contexts/LanguageContext";

vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));

function renderPanel(props: { status: string; allRoundsPlayed?: boolean }) {
  render(
    <LanguageProvider>
      <SeasonAdminPanel
        seasonId="s1"
        status={props.status}
        meceneEnabled={false}
        allRoundsPlayed={props.allRoundsPlayed}
        onActionDone={() => {}}
      />
    </LanguageProvider>,
  );
}

describe("SeasonAdminPanel — clôture manuelle", () => {
  it("invite à clôturer quand toutes les journées sont jouées", () => {
    renderPanel({ status: "in_progress", allRoundsPlayed: true });
    expect(screen.getByTestId("admin-season-ready-to-close").textContent).toContain(
      "Toutes les journées sont jouées",
    );
    expect(screen.getByTestId("admin-action-close")).toBeTruthy();
  });

  it("ne dit rien tant qu'une journée reste à jouer", () => {
    renderPanel({ status: "in_progress", allRoundsPlayed: false });
    expect(screen.queryByTestId("admin-season-ready-to-close")).toBeNull();
    expect(screen.getByTestId("admin-action-close")).toBeTruthy();
  });

  it("ne propose plus rien une fois la saison clôturée", () => {
    renderPanel({ status: "completed", allRoundsPlayed: true });
    expect(screen.queryByTestId("admin-season-ready-to-close")).toBeNull();
    expect(screen.queryByTestId("admin-action-close")).toBeNull();
  });
});
