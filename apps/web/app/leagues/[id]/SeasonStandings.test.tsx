import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { SeasonStandings } from "./SeasonStandings";
import type { StandingRow } from "./types";

// E2 — colonne "Bonus" (sous-total des points bonus snapshotés).
// F1 — ordre des colonnes + vue synthétique dépliable (retour coach).

function row(over: Partial<StandingRow> & { participantId: string }): StandingRow {
  return {
    teamId: `${over.participantId}-team`,
    teamName: over.participantId,
    roster: "humans",
    ownerId: `${over.participantId}-owner`,
    coachName: null,
    played: 1,
    wins: 1,
    draws: 0,
    losses: 0,
    points: 4,
    touchdownsFor: 3,
    touchdownsAgainst: 1,
    touchdownDifference: 2,
    casualtiesFor: 1,
    casualtiesAgainst: 0,
    seasonElo: 1000,
    status: "active",
    ...over,
  };
}

function renderStandings(
  rows: StandingRow[],
  props: {
    showSeasonElo?: boolean;
    defaultExpanded?: boolean;
    leagueId?: string | null;
    canViewRosters?: boolean;
  } = {},
) {
  render(
    <LanguageProvider>
      <SeasonStandings rows={rows} {...props} />
    </LanguageProvider>,
  );
}

/** Libellés des en-têtes, dans l'ordre du DOM (hors # et Équipe). */
function headerLabels(): string[] {
  const table = screen.getByTestId("league-standings");
  const headers = within(table).getAllByRole("columnheader");
  return headers.slice(2).map((h) => h.textContent?.trim() ?? "");
}

describe("SeasonStandings — colonne Bonus (E2)", () => {
  it("expose le sous-total bonus par équipe", () => {
    renderStandings([
      row({ participantId: "p1", bonusPoints: 2 }),
      row({ participantId: "p2", bonusPoints: 0 }),
    ]);
    expect(screen.getByTestId("standings-bonus-header")).toBeTruthy();
    expect(
      screen.getByTestId("standings-cell-p1-bonus").textContent,
    ).toContain("2");
    expect(
      screen.getByTestId("standings-cell-p2-bonus").textContent,
    ).toContain("0");
  });

  it("traite bonusPoints absent comme 0 (rétro-compat pré-E2)", () => {
    renderStandings([row({ participantId: "p1" })]);
    expect(screen.getByTestId("standings-cell-p1-bonus").textContent).toBe("0");
  });

  it("affiche un bonus négatif (malus)", () => {
    renderStandings([row({ participantId: "p1", bonusPoints: -1 })]);
    expect(
      screen.getByTestId("standings-cell-p1-bonus").textContent,
    ).toContain("-1");
  });
});

describe("SeasonStandings — ordre des colonnes (F1)", () => {
  it("affiche par défaut la version synthétique demandée par les coachs", () => {
    renderStandings([row({ participantId: "p1" })]);
    expect(headerLabels()).toEqual([
      "Pts",
      "Bo",
      "MJ",
      "For",
      "TD+",
      "TD-",
      "Diff TD",
      "Sor+",
      "Sor-",
      "Diff Sor",
    ]);
  });

  it("ajoute P / Agr / SP / Exclu / V / N / D une fois déplié", () => {
    renderStandings([row({ participantId: "p1" })]);
    fireEvent.click(screen.getByTestId("standings-toggle-details"));
    expect(headerLabels()).toEqual([
      "Pts",
      "Bo",
      "MJ",
      "For",
      "TD+",
      "TD-",
      "Diff TD",
      "Sor+",
      "Sor-",
      "Diff Sor",
      "P",
      "Agr",
      "SP",
      "Exclu",
      "V",
      "N",
      "D",
    ]);
  });

  it("place l'ELO en dernier, uniquement quand il est classant", () => {
    renderStandings([row({ participantId: "p1" })], {
      showSeasonElo: true,
      defaultExpanded: true,
    });
    expect(headerLabels().at(-1)).toBe("ELO");

    screen.getByTestId("standings-cell-p1-elo");
  });

  it("masque l'ELO quand il n'est pas classant", () => {
    renderStandings([row({ participantId: "p1" })], { defaultExpanded: true });
    expect(headerLabels()).not.toContain("ELO");
    expect(screen.queryByTestId("standings-cell-p1-elo")).toBeNull();
  });
});

describe("SeasonStandings — bascule synthétique / détail (F1)", () => {
  it("masque les colonnes de détail tant que le tableau n'est pas déplié", () => {
    renderStandings([row({ participantId: "p1", passes: 5 })]);
    expect(screen.queryByTestId("standings-cell-p1-passes")).toBeNull();
    expect(screen.queryByTestId("standings-cell-p1-wins")).toBeNull();
  });

  it("bascule dans les deux sens", () => {
    renderStandings([row({ participantId: "p1" })]);
    const toggle = screen.getByTestId("standings-toggle-details");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("standings-cell-p1-passes")).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("standings-cell-p1-passes")).toBeNull();
  });

  it("respecte `defaultExpanded`", () => {
    renderStandings([row({ participantId: "p1" })], { defaultExpanded: true });
    expect(screen.getByTestId("standings-cell-p1-passes")).toBeTruthy();
  });
});

describe("SeasonStandings — valeurs des colonnes étendues (F1)", () => {
  it("rend For / P / Agr / SP / Exclu depuis les champs API", () => {
    renderStandings(
      [
        row({
          participantId: "p1",
          forfeitPoints: -2,
          passes: 7,
          aggressions: 3,
          crowdSurges: 1,
          expulsions: 2,
        }),
      ],
      { defaultExpanded: true },
    );
    expect(screen.getByTestId("standings-cell-p1-forfeit").textContent).toBe(
      "-2",
    );
    expect(screen.getByTestId("standings-cell-p1-passes").textContent).toBe("7");
    expect(
      screen.getByTestId("standings-cell-p1-aggressions").textContent,
    ).toBe("3");
    expect(
      screen.getByTestId("standings-cell-p1-crowd-surges").textContent,
    ).toBe("1");
    expect(
      screen.getByTestId("standings-cell-p1-expulsions").textContent,
    ).toBe("2");
  });

  it("traite les champs étendus absents comme 0 (rétro-compat pré-F1)", () => {
    renderStandings([row({ participantId: "p1" })], { defaultExpanded: true });
    expect(screen.getByTestId("standings-cell-p1-forfeit").textContent).toBe(
      "0",
    );
    expect(screen.getByTestId("standings-cell-p1-passes").textContent).toBe("0");
    expect(
      screen.getByTestId("standings-cell-p1-expulsions").textContent,
    ).toBe("0");
  });

  it("utilise `casualtyDifference` quand l'API le fournit", () => {
    renderStandings([
      row({ participantId: "p1", casualtiesFor: 4, casualtiesAgainst: 1, casualtyDifference: 3 }),
    ]);
    expect(screen.getByTestId("standings-cell-p1-cas-diff").textContent).toBe(
      "3",
    );
  });

  it("recalcule Diff Sor si l'API ne le fournit pas (rétro-compat pré-F1)", () => {
    renderStandings([
      row({ participantId: "p1", casualtiesFor: 4, casualtiesAgainst: 1 }),
    ]);
    expect(screen.getByTestId("standings-cell-p1-cas-diff").textContent).toBe(
      "3",
    );
  });
});

describe("SeasonStandings — état vide", () => {
  it("affiche le message vide sans tableau ni bascule", () => {
    renderStandings([]);
    expect(screen.getByTestId("league-standings-empty")).toBeTruthy();
    expect(screen.queryByTestId("league-standings")).toBeNull();
    expect(screen.queryByTestId("standings-toggle-details")).toBeNull();
  });
});

describe("SeasonStandings — nom du coach", () => {
  it("affiche le coach sous le nom d'équipe", () => {
    renderStandings([
      row({ participantId: "p1", coachName: "Coach Ryxeuf" }),
    ]);
    expect(screen.getByTestId("standings-coach-p1").textContent).toBe(
      "Coach Ryxeuf",
    );
  });

  it("n'affiche rien quand coachName est null", () => {
    renderStandings([row({ participantId: "p1" })]);
    expect(screen.queryByTestId("standings-coach-p1")).toBeNull();
  });
});

describe("SeasonStandings — acces au roster depuis le nom d'equipe", () => {
  it("rend le nom cliquable vers la fiche de roster de la ligue", () => {
    renderStandings([row({ participantId: "p1", teamId: "team-1" })], {
      leagueId: "L1",
      canViewRosters: true,
    });
    const link = screen.getByTestId("team-roster-link-standings-p1");
    expect(link.getAttribute("href")).toBe("/leagues/L1/teams/team-1");
  });

  it("laisse le nom en texte quand la consultation n'est pas autorisee", () => {
    renderStandings([row({ participantId: "p1", teamId: "team-1" })], {
      leagueId: "L1",
      canViewRosters: false,
    });
    expect(screen.queryByTestId("team-roster-link-standings-p1")).toBeNull();
    expect(screen.getByTestId("standings-row-p1").textContent).toContain("p1");
  });

  it("laisse le nom en texte hors contexte de ligue (page recap)", () => {
    renderStandings([row({ participantId: "p1", teamId: "team-1" })], {
      canViewRosters: true,
    });
    expect(screen.queryByTestId("team-roster-link-standings-p1")).toBeNull();
  });
});
