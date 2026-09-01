import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Rendu de la page publique de partage `/r/[token]`.
 *
 * Ce que le lien partagé doit montrer d'une équipe, en plus de son
 * effectif : le LOGO du coach, son FLUFF, les postes de STAFF avec leur
 * coût, et la VALEUR de chaque joueur. Les trois derniers viennent de
 * l'API (`staffConfig`, `budgetSummary`, `playerValues`) : la page ne
 * re-dérive rien, elle affiche ce que le serveur a calculé.
 */

const { state } = vi.hoisted(() => ({
  state: { team: null as unknown, positions: null as unknown },
}));

// Le fetch SSR est routé par URL : team, détail roster, catalogue de
// compétences passent tous par `serverApi`.
vi.mock("../../lib/serverApi", () => {
  const fetcher = async (url: string) => {
    if (url.includes("/api/public/teams/")) {
      return state.team ? { team: state.team } : null;
    }
    if (url.includes("/api/rosters/")) {
      return { roster: { positions: state.positions } };
    }
    if (url.includes("/api/skills")) return { skills: [] };
    return null;
  };
  return {
    getServerApiBase: () => "http://test",
    fetchServerJson: vi.fn(fetcher),
    safeServerJson: vi.fn(fetcher),
  };
});

import PublicRosterPage from "./page";
import { LanguageProvider } from "../../contexts/LanguageContext";

const TEAM = {
  id: "team-1",
  name: "Les Rats Véloces",
  roster: "skaven",
  ruleset: "season_3",
  teamValue: 1_150_000,
  currentValue: 1_100_000,
  treasury: 50_000,
  rerolls: 2,
  cheerleaders: 1,
  assistants: 0,
  apothecary: true,
  dedicatedFans: 3,
  description: "Écumeurs des égouts de Mordheim.",
  logoUrl: "/images/team-logos/rats.png",
  players: [
    {
      id: "p1",
      name: "Skitter",
      position: "skaven_blitzer",
      number: 1,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "block",
      dead: false,
      firedAt: null,
      imageUrl: null,
      advancements: "[]",
    },
    // Licencié : hors effectif public.
    {
      id: "p2",
      name: "Ancien",
      position: "skaven_lineman",
      number: 2,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: "",
      dead: false,
      firedAt: "2026-08-01T00:00:00.000Z",
      imageUrl: null,
      advancements: "[]",
    },
  ],
  starPlayers: [],
  staffConfig: {
    rerollCost: 60_000,
    cheerleaderCost: 10_000,
    assistantCost: 10_000,
    apothecaryCost: 50_000,
    dedicatedFanCost: 5_000,
  },
  budgetSummary: {
    playersCost: 620_000,
    starPlayersCost: 0,
    staffCost: 60_000,
    rerollsCost: 120_000,
    dedicatedFansCost: 10_000,
    teamValue: 1_150_000,
    currentValue: 1_100_000,
  },
  playerValues: {
    p1: { hireCost: 90_000, advancementsCost: 20_000, value: 110_000 },
  },
};

const POSITIONS = [
  {
    slug: "skaven_blitzer",
    displayName: "Blitzeur",
    cost: 90,
    skills: "block",
    primarySkills: "G,S",
    secondarySkills: "A,P",
  },
];

async function renderPage() {
  // En production, `LanguageProvider` vient du layout racine
  // (`components/ClientLayout`) : on le remonte ici pour rendre la page
  // seule.
  const element = await PublicRosterPage({ params: { token: "tok" } });
  return render(<LanguageProvider>{element}</LanguageProvider>);
}

beforeEach(() => {
  state.team = TEAM;
  state.positions = POSITIONS;
});

describe("PublicRosterPage (/r/[token])", () => {
  it("affiche le logo de l'équipe", async () => {
    await renderPage();
    const logo = screen.getByAltText("Logo de Les Rats Véloces");
    expect(logo.getAttribute("src")).toBe("/images/team-logos/rats.png");
  });

  it("retombe sur l'emblème du roster quand le coach n'a pas de logo", async () => {
    state.team = { ...TEAM, logoUrl: null };
    const { container } = await renderPage();
    expect(screen.queryByAltText("Logo de Les Rats Véloces")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("affiche le fluff du coach", async () => {
    await renderPage();
    expect(screen.getByTestId("public-team-description").textContent).toContain(
      "Écumeurs des égouts",
    );
  });

  it("détaille le staff avec son coût", async () => {
    await renderPage();
    const rerolls = screen.getByTestId("public-staff-rerolls");
    expect(rerolls.textContent).toContain("2");
    expect(rerolls.textContent).toContain("120K po");

    const apothecary = screen.getByTestId("public-staff-apothecary");
    expect(apothecary.textContent).toContain("Oui");
    expect(apothecary.textContent).toContain("50K po");

    // Le premier fan dévoué est offert : 3 fans ⇒ 2 achetés.
    expect(screen.getByTestId("public-staff-dedicatedFans").textContent).toContain("10K po");
  });

  it("n'affiche pas de coût pour un poste non acheté", async () => {
    await renderPage();
    expect(screen.getByTestId("public-staff-assistants").textContent).not.toContain("po");
  });

  it("affiche la trésorerie, la VE et la VE actuelle", async () => {
    await renderPage();
    expect(screen.getByTestId("public-finance-treasury").textContent).toContain("50K po");
    // `toLocaleString("fr-FR")` sépare les milliers par une espace fine
    // insécable : le test la tolère plutôt que de la coder en dur.
    expect(screen.getByTestId("public-finance-teamValue").textContent).toMatch(/1\s150K po/);
    expect(screen.getByTestId("public-finance-currentValue").textContent).toMatch(/1\s100K po/);
  });

  it("explique l'écart VE → VEA quand le serveur le décompose", async () => {
    // Cas prod : une équipe Ogre à 16 joueurs, VE 1 415K / VEA 1 265K sans
    // aucun joueur indisponible. Les 150K sont « Trois-quarts à vil prix ».
    state.team = {
      ...TEAM,
      budgetSummary: {
        ...TEAM.budgetSummary,
        teamValue: 1_415_000,
        currentValue: 1_265_000,
        unavailablePlayersCost: 0,
        cheapLinemenWaived: 150_000,
      },
    };
    await renderPage();

    expect(screen.getByTestId("public-vea-gap-cheap-linemen").textContent).toBe(
      "−150K po",
    );
    // Rien d'indisponible ⇒ pas de ligne d'indisponibilité.
    expect(screen.queryByTestId("public-vea-gap-unavailable")).toBeNull();
  });

  it("liste aussi les joueurs indisponibles quand il y en a", async () => {
    state.team = {
      ...TEAM,
      budgetSummary: {
        ...TEAM.budgetSummary,
        unavailablePlayersCost: 50_000,
        cheapLinemenWaived: 0,
      },
    };
    await renderPage();

    expect(screen.getByTestId("public-vea-gap-unavailable").textContent).toBe(
      "−50K po",
    );
    expect(screen.queryByTestId("public-vea-gap-cheap-linemen")).toBeNull();
  });

  it("n'affiche aucun bloc d'écart quand la VEA vaut la VE", async () => {
    // Cas de loin le plus courant, et le seul où l'écart n'a rien à
    // expliquer : le bloc ne doit pas s'afficher vide.
    await renderPage();
    expect(screen.queryByTestId("public-vea-gap")).toBeNull();
  });

  it("affiche la valeur de chaque joueur de l'effectif", async () => {
    await renderPage();
    expect(screen.getByTestId("public-player-value-1").textContent).toBe("110K po");
    // Le licencié ne fait plus partie de l'effectif partagé.
    expect(screen.queryByTestId("public-player-value-2")).toBeNull();
    expect(screen.getByText(/Effectif/).textContent).toContain("1");
  });
});
