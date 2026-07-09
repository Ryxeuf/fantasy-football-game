import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  PreMatchPanel,
  PostMatchPanel,
  TeamIdentityBadges,
  TeamValueStrip,
  type MatchSheetReference,
  type PreMatchValues,
  type PostMatchValues,
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
  inducements: {
    home: [
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
    away: [],
  },
  starPlayers: {
    // budget home = pettyCash 150k + treasury 50k = 200k
    home: [{ slug: "morg", name: "Morg 'n' Thorg", cost: 380_000 }],
    away: [],
  },
  budget: {
    home: { ctv: 1_000_000, treasury: 50_000, pettyCash: 150_000, maxBudget: 200_000 },
    away: { ctv: 1_150_000, treasury: 0, pettyCash: 0, maxBudget: 0 },
  },
  colors: {
    home: { primary: "#1e3a8a", secondary: "#fbbf24" },
    away: { primary: "#166534", secondary: "#111827" },
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

const EMPTY_POST: PostMatchValues = {
  winningsHomeManual: null,
  winningsAwayManual: null,
  dedicatedFansDeltaHome: 0,
  dedicatedFansDeltaAway: 0,
  rankingBonusHome: null,
  rankingBonusAway: null,
  sppBonus: [],
  motmPlayerIds: [],
  costlyErrorsHome: [],
  costlyErrorsAway: [],
  purchasesHome: [],
  purchasesAway: [],
  firedPlayerIds: [],
};

describe("PostMatchPanel — FR16 assistant Erreurs Coûteuses", () => {
  it("sous 100 000 po : indique qu'aucun jet n'est requis", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={TEAM} // trésorerie 50k, pas de gains
        away={null}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId("expensive-mistake-home").textContent).toContain(
      "pas de jet",
    );
  });

  it("550 000 po : D6=2 → Catastrophe, 2D6=7 → perte 480 000 pré-remplie", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={{ ...TEAM, treasury: 550_000 }}
        away={null}
        onSave={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("expensive-mistake-home-d6"), {
      target: { value: "2" },
    });
    expect(
      screen.getByTestId("expensive-mistake-home-outcome").textContent,
    ).toContain("Catastrophe");
    fireEvent.change(screen.getByTestId("expensive-mistake-home-2d6"), {
      target: { value: "7" },
    });
    expect(
      screen.getByTestId("expensive-mistake-home-loss").textContent,
    ).toContain("480");
    fireEvent.click(screen.getByTestId("expensive-mistake-home-add"));
    // La ligne pré-remplie atterrit dans l'éditeur d'erreurs coûteuses.
    const costly = screen.getByTestId("costly-home");
    expect(within(costly).getByDisplayValue("Catastrophe")).toBeTruthy();
    expect(within(costly).getByDisplayValue("480000")).toBeTruthy();
  });

  it("la trésorerie estimée tient compte des gains et des achats", () => {
    render(
      <PostMatchPanel
        initial={{
          ...EMPTY_POST,
          purchasesHome: [{ kind: "reroll", name: "", cost: 60_000 }],
        }}
        home={{ ...TEAM, treasury: 100_000 }} // 100k + 50k gains − 60k achat = 90k
        away={null}
        onSave={vi.fn()}
        autoWinnings={{ home: 50_000, away: 0 }}
      />,
    );
    const helper = screen.getByTestId("expensive-mistake-home");
    expect(helper.textContent).toContain("90");
    expect(helper.textContent).toContain("pas de jet");
  });
});

describe("PostMatchPanel — SPP estimés (auto)", () => {
  it("affiche les SPP auto par joueur de l'équipe", () => {
    const teamWithPlayer: SheetTeam = {
      ...TEAM,
      players: [
        {
          id: "p1",
          number: 7,
          name: "Griff",
          position: "Blitzer",
          dead: false,
          missNextMatch: false,
          spp: 0,
        },
      ],
    };
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={teamWithPlayer}
        away={null}
        onSave={vi.fn()}
        computedSpp={{ p1: 7 }}
      />,
    );
    const block = screen.getByTestId("auto-spp-home");
    expect(block.textContent).toContain("+7");
    expect(block.textContent).toContain("Griff");
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

describe("PreMatchPanel — forfait par équipe", () => {
  it("coche le forfait d'une équipe, exclut l'autre, et l'enregistre", () => {
    const onSave = vi.fn();
    render(
      <PreMatchPanel
        initial={EMPTY_VALUES}
        homeName="Reikland"
        awayName="Gouged Eye"
        onSave={onSave}
        reference={REFERENCE}
      />,
    );

    const home = screen.getByTestId("forfeit-home") as HTMLInputElement;
    const away = screen.getByTestId("forfeit-away") as HTMLInputElement;
    expect(home.checked).toBe(false);
    expect(away.checked).toBe(false);

    // Cocher domicile.
    fireEvent.click(home);
    expect(home.checked).toBe(true);
    expect(away.checked).toBe(false);

    // Cocher extérieur : exclusion mutuelle (un seul forfeitSide).
    fireEvent.click(away);
    expect(home.checked).toBe(false);
    expect(away.checked).toBe(true);

    fireEvent.click(screen.getByTestId("save-pre-match"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ forfeitSide: "away" }),
    );
  });
});

describe("PostMatchPanel — achats (positions lisibles + champ Nom contextuel)", () => {
  const teamWithPlayer: SheetTeam = {
    ...TEAM,
    players: [
      {
        id: "p1",
        number: 1,
        name: "Belluaire 1",
        position: "gnome_belluaire_gnome",
        positionName: "Belluaire Gnome",
        dead: false,
        missNextMatch: false,
        spp: 0,
      },
    ],
  };

  it("affiche le nom lisible de la position (pas le slug) dans le poste d'achat joueur", () => {
    render(
      <PostMatchPanel
        initial={{
          ...EMPTY_POST,
          purchasesHome: [{ kind: "player", name: "", cost: 0 }],
        }}
        home={teamWithPlayer}
        away={null}
        onSave={vi.fn()}
      />,
    );
    const block = screen.getByTestId("purchases-home");
    expect(within(block).getByText("Belluaire Gnome")).toBeTruthy();
    expect(within(block).queryByText("gnome_belluaire_gnome")).toBeNull();
  });

  it("masque le champ Nom pour une relance", () => {
    const { unmount } = render(
      <PostMatchPanel
        initial={{
          ...EMPTY_POST,
          purchasesHome: [{ kind: "reroll", name: "", cost: 0 }],
        }}
        home={teamWithPlayer}
        away={null}
        onSave={vi.fn()}
      />,
    );
    const block = screen.getByTestId("purchases-home");
    expect(
      within(block).queryByPlaceholderText(/Nom du joueur|Libellé/),
    ).toBeNull();
    unmount();
  });

  it("affiche le champ Nom (libellé) pour une dépense diverse", () => {
    render(
      <PostMatchPanel
        initial={{
          ...EMPTY_POST,
          purchasesHome: [{ kind: "other", name: "", cost: 0 }],
        }}
        home={teamWithPlayer}
        away={null}
        onSave={vi.fn()}
      />,
    );
    const block = screen.getByTestId("purchases-home");
    expect(within(block).getByPlaceholderText(/Libellé/)).toBeTruthy();
  });
});
