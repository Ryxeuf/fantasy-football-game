import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  PreMatchPanel,
  TeamIdentityBadges,
  TeamValueStrip,
  type MatchSheetReference,
  type PreMatchValues,
  type SheetTeam,
} from "./MatchSheetPanels";

const TEAM: SheetTeam = {
  teamId: "team-home",
  name: "Reikland Reavers",
  roster: "human",
  raceName: "Humains",
  coachName: "Sepp",
  teamValue: 1_000_000,
  currentValue: 1_000_000,
  treasury: 50_000,
  players: [],
};

const REFERENCE: MatchSheetReference = {
  weatherTables: [
    {
      id: "classique",
      name: "Classique",
      results: [
        {
          roll: 2,
          condition: "Chaleur écrasante",
          description: "Des joueurs s'évanouissent.",
        },
        { roll: 7, condition: "Conditions parfaites", description: "RAS." },
        {
          roll: 11,
          condition: "Pluie battante",
          description: "Ballon glissant.",
        },
      ],
    },
  ],
  inducements: [
    {
      slug: "bribe",
      name: "Pot-de-vin",
      cost: 100_000,
      maxQuantity: 3,
      description: "Évite une expulsion.",
    },
    {
      slug: "wizard",
      name: "Magicien",
      cost: 150_000,
      maxQuantity: 1,
      description: "Lance un sort.",
    },
  ],
  starPlayers: {
    // budget home = pettyCash 150k + treasury 50k = 200k
    home: [{ slug: "morg", name: "Morg 'n' Thorg", cost: 380_000 }],
    away: [],
  },
  budget: {
    home: { ctv: 1_000_000, treasury: 50_000, pettyCash: 150_000, maxBudget: 200_000 },
    away: { ctv: 1_150_000, treasury: 0, pettyCash: 0, maxBudget: 0 },
  },
};

const EMPTY_VALUES: PreMatchValues = {
  weatherTable: "",
  weather: "",
  forfeitSide: null,
  popularityHome: null,
  popularityAway: null,
  inducementsHome: [],
  inducementsAway: [],
};

describe("TeamIdentityBadges / TeamValueStrip", () => {
  it("affiche la race et le coach", () => {
    render(<TeamIdentityBadges team={TEAM} />);
    expect(screen.getByText("Humains")).toBeTruthy();
    expect(screen.getByText("Sepp")).toBeTruthy();
  });

  it("affiche TV et cagnotte formatées", () => {
    render(<TeamValueStrip team={TEAM} />);
    // 1 000 000 -> "1 000 k" ; 50 000 -> "50 k"
    expect(screen.getByText(/1\s?000 k/)).toBeTruthy();
    expect(screen.getByText(/50 k/)).toBeTruthy();
  });
});

describe("PreMatchPanel — météo dépendante de la table", () => {
  it("propose les conditions de la table choisie et affiche la conséquence", () => {
    render(
      <PreMatchPanel
        initial={EMPTY_VALUES}
        homeName="Reikland"
        awayName="Gouged Eye"
        onSave={vi.fn()}
        reference={REFERENCE}
      />,
    );
    // La météo est désactivée tant qu'aucune table n'est choisie.
    const weatherSelect = screen.getByTestId("weather-select") as HTMLSelectElement;
    expect(weatherSelect.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("weather-table-select"), {
      target: { value: "classique" },
    });
    expect(weatherSelect.disabled).toBe(false);

    fireEvent.change(weatherSelect, { target: { value: "Pluie battante" } });
    const consequence = screen.getByTestId("weather-consequence");
    expect(consequence.textContent).toContain("Pluie battante");
    expect(consequence.textContent).toContain("Ballon glissant.");
  });
});

describe("PreMatchPanel — budget coups de pouce", () => {
  it("ajoute un coup de pouce depuis le catalogue et bloque le dépassement", () => {
    render(
      <PreMatchPanel
        initial={EMPTY_VALUES}
        homeName="Reikland"
        awayName="Gouged Eye"
        onSave={vi.fn()}
        reference={REFERENCE}
      />,
    );

    const homeBlock = screen.getByTestId("inducements-home");

    // Ajout du magicien (150k) : dans le budget (200k) -> save actif.
    fireEvent.change(
      within(homeBlock).getByTestId("inducements-home-add"),
      { target: { value: "wizard" } },
    );
    expect(within(homeBlock).getByText("Magicien")).toBeTruthy();
    expect(
      (screen.getByTestId("save-pre-match") as HTMLButtonElement).disabled,
    ).toBe(false);

    // Ajout du star player (380k) : total 530k > 200k -> dépassement.
    fireEvent.change(
      within(homeBlock).getByTestId("inducements-home-add"),
      { target: { value: "star:morg" } },
    );
    expect(
      within(homeBlock).getByTestId("inducements-home-remaining").textContent,
    ).toContain("Dépassé");
    expect(
      (screen.getByTestId("save-pre-match") as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
