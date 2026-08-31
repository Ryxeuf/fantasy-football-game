import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import {
  SkillsCatalogProvider,
  type SkillsCatalog,
} from "../../me/teams/skills-catalog-context";
import PublicRosterTable, { type PublicRosterPlayer } from "./PublicRosterTable";

/**
 * Effectif d'une équipe partagée publiquement.
 *
 * Ce que la page publique doit rendre comme la fiche du coach :
 *   - des compétences NOMMÉES (et non des slugs bruts), avec la
 *     distinction base / acquise ;
 *   - le libellé de poste servi par la base ;
 *   - la VALEUR du joueur (embauche + améliorations), pas son tarif de
 *     recrue.
 */

const CATALOG: SkillsCatalog = {
  block: {
    slug: "block",
    nameFr: "Blocage",
    nameEn: "Block",
    description: "",
    category: "General",
  },
  dodge: {
    slug: "dodge",
    nameFr: "Esquive",
    nameEn: "Dodge",
    description: "",
    category: "Agility",
  },
};

const POSITIONS = [
  {
    slug: "skaven_blitzer",
    displayName: "Blitzeur Skaven",
    cost: 90,
    skills: "block",
    primarySkills: "G,S",
    secondarySkills: "A,P",
    keywords: "Skaven",
  },
];

const PLAYER: PublicRosterPlayer = {
  id: "p1",
  name: "Skitter",
  position: "skaven_blitzer",
  number: 4,
  ma: 7,
  st: 3,
  ag: 3,
  pa: 4,
  av: 9,
  // « block » est la compétence par défaut du poste, « dodge » a été
  // acquise en montant de niveau.
  skills: "block,dodge",
  advancements: null,
};

function renderTable(props: Partial<Parameters<typeof PublicRosterTable>[0]> = {}) {
  return render(
    <LanguageProvider>
      <SkillsCatalogProvider value={CATALOG}>
        <PublicRosterTable
          players={[PLAYER]}
          rosterSlug="skaven"
          ruleset="season_3"
          positions={POSITIONS}
          playerValues={{
            p1: { hireCost: 90_000, advancementsCost: 20_000, value: 110_000 },
          }}
          {...props}
        />
      </SkillsCatalogProvider>
    </LanguageProvider>,
  );
}

describe("PublicRosterTable", () => {
  it("nomme les compétences au lieu d'afficher les slugs", () => {
    renderTable();
    expect(screen.getAllByText("Blocage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Esquive").length).toBeGreaterThan(0);
    expect(screen.queryByText("block, dodge")).toBeNull();
  });

  it("distingue la compétence acquise de la compétence de base", () => {
    renderTable();
    // Même convention que la fiche du coach : encadré orange = acquise.
    expect(screen.getAllByText("Blocage")[0].className).toContain("border-gray-300");
    expect(screen.getAllByText("Esquive")[0].className).toContain("border-orange-400");
  });

  it("affiche la VALEUR du joueur servie par l'API, pas son tarif de recrue", () => {
    renderTable();
    const cell = screen.getByTestId("public-player-value-4");
    expect(cell.textContent).toBe("110K po");
  });

  it("retombe sur le tarif d'embauche du poste quand l'API ne sert pas les valeurs", () => {
    renderTable({ playerValues: undefined });
    expect(screen.getByTestId("public-player-value-4").textContent).toBe("90K po");
  });

  it("affiche le libellé de poste de la base plutôt que le slug", () => {
    renderTable();
    expect(screen.getAllByText("Blitzeur Skaven").length).toBeGreaterThan(0);
    expect(screen.queryByText("skaven_blitzer")).toBeNull();
  });

  it("expose les accès compétences du poste", () => {
    renderTable();
    // Primaire Général + Force (« F » en français), secondaire Agilité/Passe.
    expect(screen.getAllByTitle("Primaire — Général").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Secondaire — Agilité").length).toBeGreaterThan(0);
  });

  it("reste lisible sans détail de roster (repli)", () => {
    renderTable({ positions: null, playerValues: undefined });
    // `getDisplayName` rend le slug BRUT pour une position qu'il ne
    // connaît pas : le dernier recours prettifie plutôt que d'afficher
    // « skaven_blitzer » au visiteur.
    expect(screen.queryByText("skaven_blitzer")).toBeNull();
    expect(screen.getAllByText("Skaven Blitzer").length).toBeGreaterThan(0);
    expect(screen.getByTestId("public-player-value-4").textContent).toMatch(/K po$/);
  });

  it("trie l'effectif par numéro de maillot", () => {
    renderTable({
      players: [
        { ...PLAYER, id: "p2", number: 9, name: "Vermis" },
        { ...PLAYER, id: "p1", number: 2, name: "Skitter" },
      ],
      playerValues: undefined,
    });
    const table = screen.getByRole("table");
    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      // La cellule « Joueur » porte aussi les initiales de l'avatar : on
      // vérifie l'ORDRE, pas le texte exact.
      .map((row) => row.querySelectorAll("td")[1]?.textContent ?? "");
    expect(names).toHaveLength(2);
    expect(names[0]).toContain("Skitter");
    expect(names[1]).toContain("Vermis");
  });
});
