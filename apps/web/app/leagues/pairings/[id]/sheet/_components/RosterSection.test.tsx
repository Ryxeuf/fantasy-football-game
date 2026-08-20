/**
 * Roster consultable depuis la feuille de match, y compris celui de
 * l'adversaire.
 *
 * Avant : la section n'existait qu'une fois le snapshot figé (à la 1re
 * soumission), donc rien à consulter pendant toute la préparation du
 * match. Désormais on affiche la « version du match » quand elle existe,
 * l'état courant sinon — en le disant.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RosterSection,
  livePlayersToView,
  parseRosterSnapshot,
} from "./RosterSection";
import type { SheetPlayer } from "./MatchSheetPanels";

const SNAPSHOT = {
  capturedAt: Date.UTC(2026, 4, 12),
  players: [
    {
      name: "Griff",
      position: "Blitzer",
      number: 7,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "Blocage",
      spp: 12,
    },
  ],
};

function livePlayer(over: Partial<SheetPlayer> = {}): SheetPlayer {
  return {
    id: "p1",
    number: 3,
    name: "Boris",
    position: "human_lineman",
    positionName: "Trois-quarts",
    dead: false,
    missNextMatch: false,
    spp: 2,
    skills: "",
    stats: { ma: 6, st: 3, ag: 3, pa: 4, av: 9 },
    ...over,
  } as SheetPlayer;
}

describe("RosterSection", () => {
  it("affiche la version du match quand le snapshot existe", () => {
    render(
      <RosterSection
        label="Reikland"
        raw={JSON.stringify(SNAPSHOT)}
        livePlayers={[livePlayer()]}
      />,
    );
    const toggle = screen.getByTestId("snapshot-roster-toggle-Reikland");
    expect(toggle.textContent).toContain("version du match");
    fireEvent.click(toggle);
    // Le snapshot prime : le joueur courant n'est pas affiché.
    expect(screen.getByText("Griff")).toBeTruthy();
    expect(screen.queryByText("Boris")).toBeNull();
  });

  it("retombe sur le roster courant tant que rien n'est figé", () => {
    render(<RosterSection label="Reikland" raw={null} livePlayers={[livePlayer()]} />);
    const toggle = screen.getByTestId("snapshot-roster-toggle-Reikland");
    // Le libellé annonce que ce n'est pas la version figée.
    expect(toggle.textContent).toContain("état actuel");
    fireEvent.click(toggle);
    expect(screen.getByText("Boris")).toBeTruthy();
    expect(screen.getByText("Trois-quarts")).toBeTruthy();
  });

  it("n'affiche rien sans snapshot ni roster courant", () => {
    const { container } = render(
      <RosterSection label="Reikland" raw={null} livePlayers={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("livePlayersToView", () => {
  it("exclut les joueurs morts (ils ne joueront pas ce match)", () => {
    const out = livePlayersToView([
      livePlayer(),
      livePlayer({ id: "p2", name: "Feu Boris", dead: true }),
    ]);
    expect(out?.map((p) => p.name)).toEqual(["Boris"]);
  });

  it("exclut les joueurs absents (missNextMatch : ils ratent CE match)", () => {
    const out = livePlayersToView([
      livePlayer(),
      livePlayer({ id: "p3", name: "Blessé Boris", missNextMatch: true }),
    ]);
    expect(out?.map((p) => p.name)).toEqual(["Boris"]);
  });

  it("préfère le nom de poste lisible au slug", () => {
    expect(livePlayersToView([livePlayer()])?.[0].position).toBe("Trois-quarts");
    expect(
      livePlayersToView([livePlayer({ positionName: undefined })])?.[0].position,
    ).toBe("human_lineman");
  });

  it("renvoie null sans joueur", () => {
    expect(livePlayersToView([])).toBeNull();
    expect(livePlayersToView(undefined)).toBeNull();
  });
});

describe("parseRosterSnapshot", () => {
  it("accepte l'objet natif comme la chaîne JSON", () => {
    expect(parseRosterSnapshot(SNAPSHOT)?.players).toHaveLength(1);
    expect(parseRosterSnapshot(JSON.stringify(SNAPSHOT))?.players).toHaveLength(1);
  });

  it("renvoie null sur une entrée inexploitable", () => {
    expect(parseRosterSnapshot(null)).toBeNull();
    expect(parseRosterSnapshot("pas du json")).toBeNull();
    expect(parseRosterSnapshot({ players: "nope" })).toBeNull();
  });
});
