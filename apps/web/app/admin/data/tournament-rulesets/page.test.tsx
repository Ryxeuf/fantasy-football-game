/**
 * Liste admin : l'origine de chaque définition doit être visible (base vs
 * registre du code), et un refus de suppression doit expliquer pourquoi.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const listRulesets = vi.hoisted(() => vi.fn());
const deleteRuleset = vi.hoisted(() => vi.fn());
const resetRuleset = vi.hoisted(() => vi.fn());
vi.mock("./_lib/client", async () => {
  const actual =
    await vi.importActual<typeof import("./_lib/client")>("./_lib/client");
  return { ...actual, listRulesets, deleteRuleset, resetRuleset };
});

import { RulesetApiError } from "./_lib/client";
import TournamentRulesetsAdminPage from "./page";

const ROWS = [
  {
    slug: "naf_world_cup_2027",
    enabled: true,
    source: "engine" as const,
    nameFr: "NAF World Cup 2027",
    shortLabel: "NAF WC 2027",
    version: "V2.1",
    edition: "season_3",
    format: "bb11",
    rosterCount: 31,
  },
  {
    slug: "coupe_maison",
    enabled: false,
    source: "db" as const,
    nameFr: "Coupe Maison",
    shortLabel: "Maison",
    version: "V1",
    edition: "season_3",
    format: "bb11",
    rosterCount: 4,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  listRulesets.mockResolvedValue({ rulesets: ROWS });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("liste des règlements", () => {
  it("affiche l'origine « moteur » et l'état désactivé", async () => {
    render(<TournamentRulesetsAdminPage />);
    await waitFor(() => expect(screen.getByTestId("rulesets-list")).toBeTruthy());
    expect(
      screen.getByTestId("ruleset-source-engine-naf_world_cup_2027"),
    ).toBeTruthy();
    expect(
      screen.queryByTestId("ruleset-source-engine-coupe_maison"),
    ).toBeNull();
    expect(screen.getByTestId("ruleset-disabled-coupe_maison")).toBeTruthy();
  });

  it("explique le refus de supprimer un règlement utilisé", async () => {
    deleteRuleset.mockRejectedValue(
      new RulesetApiError(
        "Règlement utilisé par 3 équipe(s), 1 ligue(s) et 0 coupe(s). Désactivez-le plutôt que de le supprimer.",
        [],
        409,
      ),
    );
    render(<TournamentRulesetsAdminPage />);
    await waitFor(() => expect(screen.getByTestId("rulesets-list")).toBeTruthy());
    fireEvent.click(screen.getByTestId("ruleset-delete-naf_world_cup_2027"));
    await waitFor(() =>
      expect(screen.getByTestId("rulesets-error").textContent).toMatch(
        /Désactivez-le plutôt/,
      ),
    );
  });

  it("réinitialise depuis le moteur après confirmation", async () => {
    resetRuleset.mockResolvedValue({ slug: "naf_world_cup_2027" });
    render(<TournamentRulesetsAdminPage />);
    await waitFor(() => expect(screen.getByTestId("rulesets-list")).toBeTruthy());
    fireEvent.click(screen.getByTestId("ruleset-reset-naf_world_cup_2027"));
    await waitFor(() =>
      expect(resetRuleset).toHaveBeenCalledWith("naf_world_cup_2027"),
    );
    expect(screen.getByTestId("rulesets-notice").textContent).toMatch(
      /réinitialisé/,
    );
  });
});
