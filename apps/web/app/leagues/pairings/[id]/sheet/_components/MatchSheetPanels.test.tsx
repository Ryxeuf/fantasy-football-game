import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  PreMatchPanel,
  PostMatchPanel,
  PlayerSelect,
  JourneymenPanel,
  TeamIdentityBadges,
  TeamValueStrip,
  InvalidateControl,
  type MatchSheetReference,
  type PreMatchValues,
  type PostMatchValues,
  type SheetPlayer,
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
    home: {
      ctv: 1_000_000,
      treasury: 50_000,
      pettyCash: 150_000,
      maxBudget: 200_000,
    },
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
  tossWinner: null,
  tossChoice: null,
  popularityHome: null,
  popularityAway: null,
  inducementsHome: [],
  inducementsAway: [],
  prayersHome: [],
  prayersAway: [],
};

function sheetPlayer(over: Partial<SheetPlayer> = {}): SheetPlayer {
  return {
    id: "p1",
    number: 1,
    name: "Boris",
    position: "human_lineman",
    positionName: "Trois-quarts",
    dead: false,
    missNextMatch: false,
    spp: 0,
    ...over,
  };
}

describe("PlayerSelect — joueurs indisponibles", () => {
  const team: SheetTeam = {
    ...TEAM,
    players: [
      sheetPlayer(),
      sheetPlayer({ id: "p2", number: 2, name: "Mort", dead: true }),
      sheetPlayer({ id: "p3", number: 3, name: "Absent", missNextMatch: true }),
    ],
  };

  it("exclut morts et absents des options par défaut", () => {
    render(
      <PlayerSelect team={team} value="" onChange={() => {}} testId="ps" />,
    );
    const options = within(screen.getByTestId("ps")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "— joueur —",
      "N°1 Boris — Trois-quarts",
    ]);
  });

  it("garde visible la valeur déjà sélectionnée même indisponible", () => {
    render(
      <PlayerSelect team={team} value="p2" onChange={() => {}} testId="ps" />,
    );
    const texts = within(screen.getByTestId("ps"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(texts).toContain("N°2 Mort — Trois-quarts ☠");
  });

  it("liste tout le monde avec includeUnavailable (licenciements)", () => {
    render(
      <PlayerSelect
        team={team}
        value=""
        onChange={() => {}}
        includeUnavailable
        testId="ps"
      />,
    );
    const options = within(screen.getByTestId("ps")).getAllByRole("option");
    expect(options).toHaveLength(4); // vide + 3 joueurs
  });
});

describe("PlayerSelect — journaliers", () => {
  const team: SheetTeam = {
    ...TEAM,
    players: [sheetPlayer()],
    journeymen: [
      {
        id: "journeyman-home-1",
        number: 12,
        name: "Journalier 1",
        position: "human_lineman",
        positionName: "Journalier (Trois-quarts)",
        stats: { ma: 6, st: 3, ag: 3, pa: 4, av: 9 },
        skills: "loner-4",
      },
    ],
  };

  it("propose les journaliers après les joueurs du roster", () => {
    render(
      <PlayerSelect team={team} value="" onChange={() => {}} testId="ps" />,
    );
    const texts = within(screen.getByTestId("ps"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(texts).toEqual([
      "— joueur —",
      "N°1 Boris — Trois-quarts",
      "N°12 Journalier 1 — Journalier (Trois-quarts)",
    ]);
  });

  it("les exclut avec includeJourneymen=false (roster réel)", () => {
    render(
      <PlayerSelect
        team={team}
        value=""
        onChange={() => {}}
        includeJourneymen={false}
        testId="ps"
      />,
    );
    const texts = within(screen.getByTestId("ps"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(texts).toEqual(["— joueur —", "N°1 Boris — Trois-quarts"]);
  });
});

describe("PlayerSelect — Star Players engagés", () => {
  const team: SheetTeam = {
    ...TEAM,
    players: [sheetPlayer()],
    starPlayersHired: [
      {
        id: "star-home-griff_oberwald",
        number: 81,
        name: "Griff Oberwald",
        position: "star_player",
        positionName: "Star Player",
        stats: { ma: 7, st: 4, ag: 2, pa: 3, av: 9 },
        skills: "block,dodge",
        slug: "griff_oberwald",
        cost: 280_000,
      },
    ],
  };

  it("propose le Star Player engagé comme acteur/cible d'évènement", () => {
    render(
      <PlayerSelect team={team} value="" onChange={() => {}} testId="ps" />,
    );
    const texts = within(screen.getByTestId("ps"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(texts).toEqual([
      "— joueur —",
      "N°1 Boris — Trois-quarts",
      "⭐ Griff Oberwald — Star Player",
    ]);
  });

  it("l'exclut des usages « roster réel » (licenciements, SPP persistés)", () => {
    render(
      <PlayerSelect
        team={team}
        value=""
        onChange={() => {}}
        includeJourneymen={false}
        testId="ps"
      />,
    );
    const texts = within(screen.getByTestId("ps"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(texts).toEqual(["— joueur —", "N°1 Boris — Trois-quarts"]);
  });
});

describe("JourneymenPanel", () => {
  const baseTeam: SheetTeam = {
    ...TEAM,
    players: [sheetPlayer()],
    journeymen: [
      {
        id: "journeyman-home-1",
        number: 12,
        name: "Journalier 1",
        position: "undead_trois_quart_squelette",
        positionName: "Journalier (Trois-quart Squelette)",
      },
      {
        id: "journeyman-home-2",
        number: 13,
        name: "Journalier 2",
        position: "undead_trois_quart_squelette",
        positionName: "Journalier (Trois-quart Squelette)",
      },
    ],
    journeymenOptions: [
      { slug: "undead_trois_quart_squelette", name: "Trois-quart Squelette" },
      { slug: "undead_trois_quart_zombie", name: "Trois-quart Zombie" },
    ],
    journeymenChoice: null,
  };

  it("affiche le nombre de journaliers", () => {
    render(
      <JourneymenPanel
        team={baseTeam}
        side="home"
        editable
        onChoose={() => {}}
      />,
    );
    expect(screen.getByTestId("journeymen-home").textContent).toContain(
      "2 journaliers",
    );
  });

  // E37 — le choix était unique et noyé dans la phrase du bandeau
  // (« je n'ai pas vu où pouvait être fait le choix »). Il y a désormais
  // une ligne par journalier, sous un intitulé explicite.
  it("expose UN sélecteur par journalier, avec son numéro et son nom", () => {
    render(
      <JourneymenPanel
        team={baseTeam}
        side="home"
        editable
        onChoose={() => {}}
      />,
    );
    expect(
      screen.getByTestId("journeymen-positions-home").textContent,
    ).toContain("Poste de chaque journalier");
    expect(screen.getByTestId("journeymen-position-home-0")).toBeTruthy();
    expect(screen.getByTestId("journeymen-position-home-1")).toBeTruthy();
    expect(screen.getByTestId("journeyman-row-home-0").textContent).toContain(
      "N°12 Journalier 1",
    );
    expect(screen.getByTestId("journeyman-row-home-1").textContent).toContain(
      "N°13 Journalier 2",
    );
  });

  it("remonte le RANG du journalier modifié", () => {
    const onChoose = vi.fn();
    render(
      <JourneymenPanel
        team={baseTeam}
        side="home"
        editable
        onChoose={onChoose}
      />,
    );
    fireEvent.change(screen.getByTestId("journeymen-position-home-1"), {
      target: { value: "undead_trois_quart_zombie" },
    });
    expect(onChoose).toHaveBeenCalledWith(1, "undead_trois_quart_zombie");
  });

  it("présélectionne le poste EFFECTIF de chaque journalier", () => {
    render(
      <JourneymenPanel
        team={{
          ...baseTeam,
          journeymenChoices: [
            "undead_trois_quart_squelette",
            "undead_trois_quart_zombie",
          ],
        }}
        side="home"
        editable
        onChoose={() => {}}
      />,
    );
    expect(
      (screen.getByTestId("journeymen-position-home-0") as HTMLSelectElement)
        .value,
    ).toBe("undead_trois_quart_squelette");
    expect(
      (screen.getByTestId("journeymen-position-home-1") as HTMLSelectElement)
        .value,
    ).toBe("undead_trois_quart_zombie");
  });

  it("un seul poste de Trois-quart : pas de sélecteur, mais le poste reste annoncé", () => {
    render(
      <JourneymenPanel
        team={{
          ...baseTeam,
          journeymenOptions: [
            { slug: "skaven_rat_des_clans_skaven", name: "Rat des clans" },
          ],
        }}
        side="home"
        editable
        onChoose={() => {}}
      />,
    );
    expect(screen.queryByTestId("journeymen-positions-home")).toBeNull();
    expect(screen.getByTestId("journeymen-home").textContent).toContain(
      "Journalier (Trois-quart Squelette)",
    );
  });

  it("feuille verrouillée : les sélecteurs sont désactivés", () => {
    render(
      <JourneymenPanel
        team={baseTeam}
        side="home"
        editable={false}
        onChoose={() => {}}
      />,
    );
    expect(
      (screen.getByTestId("journeymen-position-home-0") as HTMLSelectElement)
        .disabled,
    ).toBe(true);
  });

  it("ne rend rien quand l'équipe aligne 11 joueurs (aucun journalier)", () => {
    const { container } = render(
      <JourneymenPanel
        team={{ ...baseTeam, journeymen: [] }}
        side="home"
        editable
        onChoose={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

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
    const weatherSelect = screen.getByTestId(
      "weather-select",
    ) as HTMLSelectElement;
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

describe("PreMatchPanel — facteur de popularité (1D3 + fans dévoués)", () => {
  it("affiche les fans dévoués réels de chaque équipe dans la formule", () => {
    render(
      <PreMatchPanel
        initial={EMPTY_VALUES}
        homeName="Reikland"
        awayName="Gouged Eye"
        homeFans={4}
        awayFans={1}
        onSave={vi.fn()}
        reference={REFERENCE}
      />,
    );
    expect(screen.getByTestId("popularity-label-home").textContent).toBe(
      "Facteur de popularité (1D3 + 4 fans dévoués)",
    );
    expect(screen.getByTestId("popularity-label-away").textContent).toBe(
      "Facteur de popularité (1D3 + 1 fans dévoués)",
    );
    // Fourchette attendue du jet : fans+1 à fans+3.
    expect(screen.getByText(/entre 5 et 7/)).toBeTruthy();
    expect(screen.getByText(/entre 2 et 4/)).toBeTruthy();
  });

  it("reste générique quand l'API ne fournit pas les fans (rétro-compat)", () => {
    render(
      <PreMatchPanel
        initial={EMPTY_VALUES}
        homeName="Reikland"
        awayName="Gouged Eye"
        onSave={vi.fn()}
        reference={REFERENCE}
      />,
    );
    expect(screen.getByTestId("popularity-label-home").textContent).toBe(
      "Facteur de popularité (1D3 + fans dévoués)",
    );
    expect(screen.queryByText(/entre \d+ et \d+/)).toBeNull();
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

describe("PostMatchPanel — trésorerie disponible pour les achats", () => {
  it("affiche la cagnotte figée + les gains du match", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={{ ...TEAM, treasury: 100_000 }}
        away={null}
        onSave={vi.fn()}
        autoWinnings={{ home: 50_000, away: 0 }}
      />,
    );
    const hint = screen.getByTestId("purchases-home-treasury");
    expect(hint.textContent).toContain("Trésorerie disponible");
    expect(hint.textContent).toContain("150");
  });

  it("décompte les achats et alerte sur un dépassement", () => {
    render(
      <PostMatchPanel
        initial={{
          ...EMPTY_POST,
          purchasesHome: [{ kind: "reroll", name: "", cost: 200_000 }],
        }}
        home={{ ...TEAM, treasury: 100_000 }}
        away={null}
        onSave={vi.fn()}
        autoWinnings={{ home: 50_000, away: 0 }}
      />,
    );
    const hint = screen.getByTestId("purchases-home-treasury");
    expect(hint.textContent).toContain("dépassement de trésorerie");
  });
});

describe("PostMatchPanel — recrutement d'un journalier", () => {
  const teamWithJourneyman: SheetTeam = {
    ...TEAM,
    players: [sheetPlayer()],
    journeymen: [
      {
        id: "journeyman-home-1",
        number: 12,
        name: "Journalier 1",
        position: "human_lineman",
        positionName: "Journalier (Trois-quarts)",
        stats: { ma: 6, st: 3, ag: 3, pa: 4, av: 9 },
        skills: "loner-4",
        cost: 50_000,
      },
    ],
  };

  it("propose les journaliers du match et pré-remplit leur prix", () => {
    const onSave = vi.fn();
    render(
      <PostMatchPanel
        initial={{
          ...EMPTY_POST,
          purchasesHome: [{ kind: "journeyman", name: "", cost: 0 }],
        }}
        home={teamWithJourneyman}
        away={null}
        onSave={onSave}
        journeymanHireCost={() => 70_000}
      />,
    );
    const picker = screen.getByTestId("purchases-home-journeyman-0");
    expect(
      within(picker)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["journalier…", "N°12 Journalier 1 — Journalier (Trois-quarts)"]);

    fireEvent.change(picker, { target: { value: "journeyman-home-1" } });
    // Prix pré-rempli = poste + surcoût de l'évolution de l'étape 3.
    expect(screen.getByDisplayValue("70000")).toBeTruthy();
  });
});

describe("PostMatchPanel — variation des fans dévoués", () => {
  it("rappelle les fans actuels et la règle du D6 quand l'API les fournit", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={{ ...TEAM, dedicatedFans: 3 }}
        away={null}
        onSave={vi.fn()}
      />,
    );
    const hint = screen.getByTestId("fans-hint-home");
    expect(hint.textContent).toContain("Actuel : 3");
    expect(hint.textContent).toContain("+1 si D6 ≥ 3");
    expect(hint.textContent).toContain("−1 si D6 < 3");
  });

  it("n'affiche pas d'aide sans le champ dedicatedFans (rétro-compat)", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={TEAM}
        away={null}
        onSave={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("fans-hint-home")).toBeNull();
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

  it("inclut les journaliers (leurs PSP comptent à leur recrutement)", () => {
    const teamWithJourneyman: SheetTeam = {
      ...TEAM,
      players: [sheetPlayer({ id: "p1", name: "Boris" })],
      journeymen: [
        {
          id: "journeyman-home-1",
          number: 12,
          name: "Journalier 1",
          position: "orc_trois_quart_gobelin",
          positionName: "Journalier (Trois-quart Gobelin)",
        },
      ],
    };
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={teamWithJourneyman}
        away={null}
        onSave={vi.fn()}
        computedSpp={{ "journeyman-home-1": 4 }}
      />,
    );
    const block = screen.getByTestId("auto-spp-home");
    expect(block.textContent).toContain("N°12 Journalier 1");
    expect(block.textContent).toContain("+4");
    expect(block.textContent).not.toContain("Boris");
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
    fireEvent.change(within(homeBlock).getByTestId("inducements-home-add"), {
      target: { value: "wizard" },
    });
    expect(within(homeBlock).getByText("Magicien")).toBeTruthy();
    expect(
      (screen.getByTestId("save-pre-match") as HTMLButtonElement).disabled,
    ).toBe(false);

    // Ajout du star player (380k) : total 530k > 200k -> dépassement.
    fireEvent.change(within(homeBlock).getByTestId("inducements-home-add"), {
      target: { value: "star:morg" },
    });
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

describe("PreMatchPanel — toss (vainqueur + choix du coup d'envoi)", () => {
  it("saisit le vainqueur puis son choix, déduit l'équipe qui engage et enregistre", () => {
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

    const winner = screen.getByTestId(
      "toss-winner-select",
    ) as HTMLSelectElement;
    const choice = screen.getByTestId(
      "toss-choice-select",
    ) as HTMLSelectElement;
    // Le choix appartient au vainqueur : désactivé tant qu'il n'est pas saisi.
    expect(choice.disabled).toBe(true);
    expect(screen.queryByTestId("toss-kicking-team")).toBeNull();

    fireEvent.change(winner, { target: { value: "home" } });
    expect(choice.disabled).toBe(false);

    // Vainqueur domicile qui choisit de recevoir -> l'extérieur engage.
    fireEvent.change(choice, { target: { value: "receive" } });
    expect(screen.getByTestId("toss-kicking-team").textContent).toContain(
      "Gouged Eye",
    );

    // Vainqueur domicile qui choisit d'engager -> domicile engage.
    fireEvent.change(choice, { target: { value: "kick" } });
    expect(screen.getByTestId("toss-kicking-team").textContent).toContain(
      "Reikland",
    );

    fireEvent.click(screen.getByTestId("save-pre-match"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ tossWinner: "home", tossChoice: "kick" }),
    );
  });

  it("efface le choix quand le vainqueur est retiré", () => {
    const onSave = vi.fn();
    render(
      <PreMatchPanel
        initial={{ ...EMPTY_VALUES, tossWinner: "away", tossChoice: "kick" }}
        homeName="Reikland"
        awayName="Gouged Eye"
        onSave={onSave}
        reference={REFERENCE}
      />,
    );

    const winner = screen.getByTestId(
      "toss-winner-select",
    ) as HTMLSelectElement;
    // Valeurs initiales rechargées depuis la feuille.
    expect(winner.value).toBe("away");
    expect(screen.getByTestId("toss-kicking-team").textContent).toContain(
      "Gouged Eye",
    );

    fireEvent.change(winner, { target: { value: "" } });
    expect(screen.queryByTestId("toss-kicking-team")).toBeNull();

    fireEvent.click(screen.getByTestId("save-pre-match"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ tossWinner: null, tossChoice: null }),
    );
  });
});

describe("PreMatchPanel — Prières à Nuffle (D16)", () => {
  it("ajoute une prière depuis la table, bloque le doublon et l'enregistre", () => {
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

    // Ajoute le résultat 3 (Stiletto) côté domicile.
    fireEvent.change(screen.getByTestId("prayers-home-add"), {
      target: { value: "3" },
    });
    const entry = screen.getByTestId("prayers-home-entry-3");
    expect(entry.textContent).toContain("Stylet");

    // Le jet 3 disparaît des options (doublons relancés à la table).
    const addSelect = screen.getByTestId(
      "prayers-home-add",
    ) as HTMLSelectElement;
    const values = Array.from(addSelect.options).map((o) => o.value);
    expect(values).not.toContain("3");

    fireEvent.click(screen.getByTestId("save-pre-match"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        prayersHome: [{ roll: 3, prayerId: "stiletto" }],
        prayersAway: [],
      }),
    );
  });

  it("cape à 3 prières par équipe (coup de pouce 0-3)", () => {
    render(
      <PreMatchPanel
        initial={{
          ...EMPTY_VALUES,
          prayersAway: [{ roll: 1 }, { roll: 2 }, { roll: 8 }],
        }}
        homeName="Reikland"
        awayName="Gouged Eye"
        onSave={vi.fn()}
        reference={REFERENCE}
      />,
    );
    expect(screen.queryByTestId("prayers-away-add")).toBeNull();
    expect(screen.getByTestId("prayers-away").textContent).toContain(
      "Maximum de 3",
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

describe("PostMatchPanel — catalogue d'embauche (E46/E47)", () => {
  const teamWithPlayer: SheetTeam = {
    ...TEAM,
    players: [
      {
        id: "p1",
        number: 1,
        name: "Blitzeur 1",
        position: "he_blitzer",
        positionName: "Blitzeur Haut Elfe",
        dead: false,
        missNextMatch: false,
        spp: 0,
      },
    ],
  };

  // Haut Elfes : relance a 50 000 po a la construction => 100 000 apres match.
  const OPTIONS = {
    home: {
      positions: [
        {
          slug: "he_lineman",
          name: "Trois-quart Haut Elfe",
          cost: 60_000,
          currentCount: 0,
          maxCount: 16,
          canAdd: true,
        },
        {
          slug: "he_blitzer",
          name: "Blitzeur Haut Elfe",
          cost: 100_000,
          currentCount: 2,
          maxCount: 2,
          canAdd: false,
        },
      ],
      staff: [
        {
          kind: "reroll" as const,
          name: "Relance d'équipe",
          cost: 100_000,
          currentCount: 1,
          maxCount: 8,
          canAdd: true,
        },
        {
          kind: "assistant" as const,
          name: "Assistant",
          cost: 10_000,
          currentCount: 0,
          maxCount: 6,
          canAdd: true,
        },
        {
          kind: "cheerleader" as const,
          name: "Pom-pom girl",
          cost: 10_000,
          currentCount: 0,
          maxCount: 12,
          canAdd: true,
        },
        {
          kind: "apothecary" as const,
          name: "Apothicaire",
          cost: 50_000,
          currentCount: 0,
          maxCount: 0,
          canAdd: false,
        },
        {
          kind: "dedicated_fan" as const,
          name: "Fan dévoué",
          cost: 10_000,
          currentCount: 1,
          maxCount: 6,
          canAdd: true,
        },
      ],
    },
  };

  function renderWith(purchase: PostMatchValues["purchasesHome"][number]) {
    return render(
      <PostMatchPanel
        initial={{ ...EMPTY_POST, purchasesHome: [purchase] }}
        home={teamWithPlayer}
        away={null}
        onSave={vi.fn()}
        purchaseOptions={OPTIONS}
      />,
    );
  }

  it("propose les postes du ROSTER, pas seulement ceux déjà à l'effectif", () => {
    // Sans catalogue, le picker listait les postes des joueurs presents :
    // un Trois-quart jamais recrute n'etait donc jamais proposé.
    renderWith({ kind: "player", name: "", cost: 0 });
    const labels = within(screen.getByTestId("purchases-home-position-0"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toEqual([
      "poste…",
      "Trois-quart Haut Elfe (0/16) — 60 k",
      "Blitzeur Haut Elfe (2/2) — complet",
    ]);
  });

  it("désactive un poste dont le quota est atteint", () => {
    renderWith({ kind: "player", name: "", cost: 0 });
    const options = within(
      screen.getByTestId("purchases-home-position-0"),
    ).getAllByRole("option") as HTMLOptionElement[];
    expect(options.find((o) => o.value === "he_blitzer")?.disabled).toBe(true);
    expect(options.find((o) => o.value === "he_lineman")?.disabled).toBe(false);
  });

  it("remplit le prix du poste choisi", () => {
    renderWith({ kind: "player", name: "", cost: 0 });
    fireEvent.change(screen.getByTestId("purchases-home-position-0"), {
      target: { value: "he_lineman" },
    });
    expect(
      (screen.getByTestId("purchases-home-cost-0") as HTMLInputElement).value,
    ).toBe("60000");
  });

  it("remplit le prix d'APRÈS-MATCH d'une relance (× 2)", () => {
    renderWith({ kind: "player", name: "", cost: 0 });
    fireEvent.change(screen.getByTestId("purchases-home-kind-0"), {
      target: { value: "reroll" },
    });
    expect(
      (screen.getByTestId("purchases-home-cost-0") as HTMLInputElement).value,
    ).toBe("100000");
  });

  it("remplit le prix du staff choisi", () => {
    renderWith({ kind: "staff", name: "", cost: 0 });
    fireEvent.change(screen.getByTestId("purchases-home-staff-0"), {
      target: { value: "assistant" },
    });
    expect(
      (screen.getByTestId("purchases-home-cost-0") as HTMLInputElement).value,
    ).toBe("10000");
  });

  it("désactive un staff auquel le roster n'a pas droit", () => {
    renderWith({ kind: "staff", name: "", cost: 0 });
    const options = within(
      screen.getByTestId("purchases-home-staff-0"),
    ).getAllByRole("option") as HTMLOptionElement[];
    expect(options.find((o) => o.value === "apothecary")?.disabled).toBe(true);
    expect(options.find((o) => o.value === "cheerleader")?.disabled).toBe(
      false,
    );
  });

  it("remet le prix à zéro quand on change de type d'achat", () => {
    renderWith({ kind: "reroll", name: "", cost: 100_000 });
    fireEvent.change(screen.getByTestId("purchases-home-kind-0"), {
      target: { value: "other" },
    });
    expect(
      (screen.getByTestId("purchases-home-cost-0") as HTMLInputElement).value,
    ).toBe("0");
  });

  it("signale un montant saisi qui s'écarte du prix catalogue", () => {
    renderWith({ kind: "reroll", name: "", cost: 50_000 });
    expect(
      screen.getByTestId("purchases-home-cost-hint-0").textContent,
    ).toContain("100 k");
  });

  it("ne signale rien quand le montant est le prix catalogue", () => {
    renderWith({ kind: "reroll", name: "", cost: 100_000 });
    expect(screen.queryByTestId("purchases-home-cost-hint-0")).toBeNull();
  });

  it("retombe sur les postes de l'effectif sans catalogue (rétro-compat)", () => {
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
    const labels = within(screen.getByTestId("purchases-home-position-0"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toEqual(["poste…", "Blitzeur Haut Elfe"]);
  });
});

describe("InvalidateControl — avertissements morts / licenciements", () => {
  it("annonce les joueurs ressuscites ET les licencies reintegres", () => {
    render(
      <InvalidateControl
        canInvalidate
        deadCount={2}
        firedCount={1}
        onInvalidate={vi.fn()}
      />,
    );
    expect(screen.getByTestId("invalidate-dead-warning").textContent).toContain(
      "seront ressuscités",
    );
    expect(
      screen.getByTestId("invalidate-fired-warning").textContent,
    ).toContain("sera réintégré");
  });

  it("n'affiche aucun avertissement quand le match n'a rien pose", () => {
    render(<InvalidateControl canInvalidate onInvalidate={vi.fn()} />);
    expect(screen.queryByTestId("invalidate-dead-warning")).toBeNull();
    expect(screen.queryByTestId("invalidate-fired-warning")).toBeNull();
  });

  it("demande confirmation en listant les deux effets", async () => {
    const onInvalidate = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <InvalidateControl
        canInvalidate
        deadCount={1}
        firedCount={2}
        onInvalidate={onInvalidate}
      />,
    );
    fireEvent.click(screen.getByText("Invalider le match"));
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("1 joueur(s) tué(s) ressuscité(s)"),
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("2 joueur(s) licencié(s) réintégré(s)"),
    );
    // Refus => aucune invalidation.
    expect(onInvalidate).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

// ────────────────── E41 — SÉQUENCE D'APRÈS-MATCH ──────────────────
//
// L'ORDRE des étapes est une règle (livre p.68), pas une mise en page :
// une compétence gagnée à l'étape 3 change le prix d'embauche d'un
// journalier à l'étape 4, et les embauches précèdent les renvois. Le
// panneau plaçait les erreurs coûteuses AVANT les licenciements et ne
// numérotait rien — d'où le retour « je ne vois pas d'évolution ».

describe("PostMatchPanel — séquence d'après-match (E41)", () => {
  /** Ordre d'apparition des étapes dans le DOM, pour un côté. */
  function stepOrder(side: "home" | "away"): number[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        `[data-testid^="post-match-step-"][data-testid$="-${side}"]`,
      ),
    ).map((el) => Number(el.dataset.testid!.split("-")[3]));
  }

  it("rend les 5 étapes du livre, numérotées et dans l'ordre", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={TEAM}
        away={null}
        onSave={vi.fn()}
      />,
    );
    expect(stepOrder("home")).toEqual([1, 2, 3, 4, 5]);
  });

  it("nomme chaque étape comme le livre", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={TEAM}
        away={null}
        onSave={vi.fn()}
      />,
    );
    const label = (n: number) =>
      screen.getByTestId(`post-match-step-${n}-home`).textContent ?? "";
    expect(label(1)).toContain("Consigner résultats et gains");
    expect(label(2)).toContain("Mettre à jour les fans dévoués");
    expect(label(3)).toContain("Amélioration de joueurs");
    expect(label(4)).toContain("Embauches puis renvois");
    expect(label(5)).toContain("Erreurs coûteuses");
  });

  it("place chaque saisie dans SON étape", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={TEAM}
        away={null}
        onSave={vi.fn()}
      />,
    );
    const step = (n: number) => screen.getByTestId(`post-match-step-${n}-home`);
    expect(within(step(1)).getByTestId("motm-home")).toBeTruthy();
    expect(within(step(1)).getByTestId("winnings-home")).toBeTruthy();
    expect(within(step(1)).getByTestId("ranking-bonus-home")).toBeTruthy();
    expect(within(step(2)).getByTestId("fans-home")).toBeTruthy();
    expect(within(step(3)).getByTestId("spp-bonus-home")).toBeTruthy();
    expect(within(step(4)).getByTestId("purchases-home")).toBeTruthy();
    expect(within(step(4)).getByTestId("fired-home")).toBeTruthy();
    expect(within(step(5)).getByTestId("costly-home")).toBeTruthy();
  });

  // Le point précis du retour : « 4/ EMBAUCHES puis RENVOIS... 5/ Erreurs
  // coûteuses » — les licenciements venaient APRÈS les erreurs coûteuses.
  it("les renvois précèdent les erreurs coûteuses, et les embauches les renvois", () => {
    const { container } = render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={TEAM}
        away={null}
        onSave={vi.fn()}
      />,
    );
    const html = container.innerHTML;
    const at = (testId: string) => html.indexOf(`data-testid="${testId}"`);
    expect(at("purchases-home")).toBeGreaterThan(-1);
    expect(at("purchases-home")).toBeLessThan(at("fired-home"));
    expect(at("fired-home")).toBeLessThan(at("costly-home"));
  });

  it("annonce la séquence en tête de panneau", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={TEAM}
        away={null}
        onSave={vi.fn()}
      />,
    );
    const legend = screen.getByTestId("post-match-sequence-legend").textContent;
    expect(legend).toContain("fans dévoués");
    expect(legend).toContain("embauches puis renvois");
    expect(legend).toContain("erreurs coûteuses");
  });

  // L'étape 3 se joue sur un autre onglet : sans rappel, le coach saute
  // l'amélioration de joueurs et embauche au mauvais prix.
  it("l'étape 3 renvoie vers l'onglet Évolutions", () => {
    const onGo = vi.fn();
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={TEAM}
        away={null}
        onSave={vi.fn()}
        onGoToAdvancements={onGo}
      />,
    );
    const step3 = screen.getByTestId("post-match-step-3-home");
    expect(step3.textContent).toContain("Évolutions");
    fireEvent.click(screen.getByTestId("go-to-advancements-home"));
    expect(onGo).toHaveBeenCalled();
  });

  it("sans bascule fournie, l'étape 3 rappelle seulement où saisir", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={TEAM}
        away={null}
        onSave={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("go-to-advancements-home")).toBeNull();
    expect(screen.getByTestId("advancements-hint-home").textContent).toContain(
      "Évolutions",
    );
  });

  it("les deux équipes suivent la même séquence", () => {
    render(
      <PostMatchPanel
        initial={EMPTY_POST}
        home={TEAM}
        away={{ ...TEAM, teamId: "team-away", name: "Orcland Raiders" }}
        onSave={vi.fn()}
      />,
    );
    expect(stepOrder("away")).toEqual([1, 2, 3, 4, 5]);
  });
});
