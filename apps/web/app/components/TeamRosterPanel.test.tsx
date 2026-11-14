import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext";
import TeamRosterPanel, { type RosterPlayer, type RosterTeam } from "./TeamRosterPanel";

const TEAM: RosterTeam = {
  id: "T1",
  name: "Gones Kass'Krânes",
  roster: "necromantic_horror",
  ruleset: "season_3",
  raceName: "Horreurs Nécromantiques",
  coachName: "Sepp",
  treasury: 40_000,
  teamValue: 1_350_000,
  currentValue: 1_350_000,
  rerolls: 3,
  cheerleaders: 0,
  assistants: 1,
  apothecary: false,
  dedicatedFans: 1,
};

const GHOUL: RosterPlayer = {
  id: "pl1",
  name: "Coureur Goule 1",
  position: "necromantic_ghoul",
  positionName: "Coureur Goule",
  number: 1,
  ma: 7,
  st: 3,
  ag: 3,
  pa: 3,
  av: 8,
  skills: "dodge,regeneration,block",
  spp: 9,
  dead: false,
  matchesPlayed: 4,
  totalTouchdowns: 3,
  totalCasualties: 1,
  totalCompletions: 2,
  totalInterceptions: 1,
  aggressions: 2,
  missNextMatch: true,
  nigglingInjuries: 1,
  statReductions: { ma: 0, st: 0, ag: 0, pa: 0, av: 0 },
  value: 95_000,
};

const DEAD: RosterPlayer = {
  ...GHOUL,
  id: "pl2",
  name: "Golem",
  number: 2,
  dead: true,
  statusSource: "match_sheet",
  missNextMatch: false,
  nigglingInjuries: 0,
};

const STAR: RosterPlayer = {
  ...GHOUL,
  id: "star:morg",
  name: "Morg 'n' Thorg",
  number: null,
  note: "Star Player",
};

const ROSTER_DETAIL = {
  roster: {
    positions: [
      {
        slug: "necromantic_ghoul",
        displayName: "Coureur Goule",
        cost: 75,
        skills: "dodge,regeneration",
        keywords: "Mort-Vivant, Goule",
        primarySkills: "A,G",
        secondarySkills: "S",
      },
    ],
  },
};

function renderPanel(props: Partial<Parameters<typeof TeamRosterPanel>[0]> = {}) {
  return render(
    <LanguageProvider>
      <TeamRosterPanel testId="panel" team={TEAM} players={[GHOUL, DEAD]} {...props} />
    </LanguageProvider>,
  );
}

describe("TeamRosterPanel — cartes mobiles", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: String(url).includes("/api/rosters/"),
        json: () => Promise.resolve(ROSTER_DETAIL),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rend un tableau réservé aux grands écrans et des cartes pour les petits", () => {
    renderPanel();
    expect(screen.getByTestId("roster-table").className).toContain("hidden");
    expect(screen.getByTestId("roster-table").className).toContain("xl:block");
    expect(screen.getByTestId("roster-cards").className).toContain("xl:hidden");
    expect(screen.getByTestId("roster-player-card-pl1")).toBeTruthy();
    expect(screen.getByTestId("roster-player-card-pl2")).toBeTruthy();
  });

  it("n'affiche pas moins d'informations dans une carte que dans le tableau", () => {
    renderPanel();
    const card = within(screen.getByTestId("roster-player-card-pl1"));
    // Identité + caractéristiques.
    expect(card.getByText("Coureur Goule 1")).toBeTruthy();
    expect(card.getByText("Coureur Goule")).toBeTruthy();
    for (const label of ["MA", "ST", "AG", "PA", "AV"]) {
      expect(card.getByText(label)).toBeTruthy();
    }
    expect(card.getByText("Blocage")).toBeTruthy();
    // Les sept statistiques de la compétition.
    const stats = within(screen.getByTestId("player-stats-mobile-pl1"));
    for (const [label, value] of [
      ["MJ", "4"],
      ["TD", "3"],
      ["Élim.", "1"],
      ["Pas.", "2"],
      ["Int.", "1"],
      ["Agr.", "2"],
      ["PSP", "9"],
    ]) {
      expect(stats.getByText(label).nextSibling?.textContent).toBe(value);
    }
    expect(screen.getByTestId("player-matches-mobile-pl1").textContent).toBe("4");
    expect(screen.getByTestId("player-td-mobile-pl1").textContent).toBe("3");
    // Valeur, blessures, disponibilité.
    expect(screen.getByTestId("player-value-mobile-pl1").textContent).toBe("95 k po");
    expect(screen.getByTestId("player-injuries-mobile-pl1").textContent).toBe("1 BP");
    expect(screen.getByTestId("player-availability-mobile-pl1").textContent).toContain(
      "Absent",
    );
    // Mort : origine expliquée, dispo ☠.
    expect(
      screen.getByTestId("player-death-origin-mobile-pl2").getAttribute("title"),
    ).toBe("Décédé — feuille de match");
    expect(screen.getByTestId("player-availability-mobile-pl2").textContent).toContain("☠");
  });

  it("affiche mots-clés et accès aux compétences lus sur le roster de l'édition", async () => {
    renderPanel();
    await waitFor(() =>
      expect(
        within(screen.getByTestId("roster-player-card-pl1")).getByText("Goule"),
      ).toBeTruthy(),
    );
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/rosters/necromantic_horror?lang=fr&ruleset=season_3",
    );
    const card = within(screen.getByTestId("roster-player-card-pl1"));
    expect(card.getByText("Mort-Vivant")).toBeTruthy();
    expect(card.getByText("Accès :")).toBeTruthy();
    // Même complément dans le tableau.
    expect(
      within(screen.getByTestId("roster-table")).getAllByText("Mort-Vivant"),
    ).toHaveLength(2);
  });

  it("reste lisible sans le détail du roster (échec réseau)", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    renderPanel();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByTestId("roster-player-card-pl1")).toBeTruthy();
    expect(screen.queryByText("Accès :")).toBeNull();
  });

  it("coupe : ni blessures ni dispo, stats de la coupe, pas de carte PNG pour un Star Player", () => {
    renderPanel({ competition: "cup", players: [GHOUL, STAR] });
    expect(screen.queryByTestId("player-injuries-mobile-pl1")).toBeNull();
    expect(screen.queryByTestId("player-availability-mobile-pl1")).toBeNull();
    expect(screen.getByTestId("player-note-mobile-star:morg").textContent).toBe(
      "Star Player",
    );
    expect(screen.getByTestId("player-card-mobile-pl1")).toBeTruthy();
    expect(screen.queryByTestId("player-card-mobile-star:morg")).toBeNull();
    expect(screen.queryByTestId("player-card-star:morg")).toBeNull();
    expect(
      within(screen.getByTestId("player-stats-mobile-pl1")).getByTitle(
        "Matchs joués dans la coupe",
      ),
    ).toBeTruthy();
  });

  it("le commissaire retire un mort depuis la carte mobile", () => {
    const onRemove = vi.fn();
    renderPanel({ canRemoveDead: true, onRemoveDeadPlayer: onRemove });
    expect(screen.queryByTestId("remove-dead-player-mobile-pl1")).toBeNull();
    fireEvent.click(screen.getByTestId("remove-dead-player-mobile-pl2"));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "pl2" }));
  });

  it("ouvre la carte PNG du joueur depuis la carte mobile", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPanel();
    fireEvent.click(screen.getByTestId("player-card-download-mobile-pl1"));
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.href).toContain("/api/player-card?d=");
    expect(anchor.href).toContain("download=1");
    click.mockRestore();
  });
});
