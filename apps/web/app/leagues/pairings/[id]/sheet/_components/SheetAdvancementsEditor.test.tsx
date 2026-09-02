/**
 * Nouveau workflow évolutions : la saisie fait partie de la feuille de
 * match (staging par coach, PSP projetés), l'application au roster
 * n'intervient qu'à la validation commissaire.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../../../../contexts/LanguageContext";
import {
  SheetAdvancementsEditor,
  StagedAdvancementsRecap,
  type StagedAdvancementEntry,
} from "./SheetAdvancementsEditor";
import type { SheetJourneyman, SheetPlayer } from "./MatchSheetPanels";

const apiRequest = vi.fn();
vi.mock("../../../../../lib/api-client", () => ({
  apiRequest: (path: string, init?: RequestInit) => apiRequest(path, init),
  ApiClientError: class extends Error {},
}));

function player(overrides: Partial<SheetPlayer> & { id: string }): SheetPlayer {
  return {
    number: 1,
    name: "Joueur",
    position: "amazon_guerriere_aigle",
    dead: false,
    missNextMatch: false,
    spp: 0,
    skills: "",
    advancementsTaken: 0,
    stats: { ma: 6, st: 3, ag: 3, pa: 4, av: 9 },
    ...overrides,
  };
}

/** Journalier orque : Trois-quart Gobelin (Principale A,K), 3 PSP ce match. */
function journeyman(over: Partial<SheetJourneyman> = {}): SheetJourneyman {
  return {
    id: "journeyman-home-1",
    number: 12,
    name: "Journalier 1",
    position: "orc_trois_quart_gobelin",
    positionName: "Journalier (Trois-quart Gobelin)",
    stats: { ma: 6, st: 2, ag: 3, pa: 4, av: 8 },
    skills: "dodge,right-stuff,stunty,loner-4",
    cost: 40_000,
    ...over,
  };
}

function setup(props: {
  players: SheetPlayer[];
  journeymen?: SheetJourneyman[];
  staged?: StagedAdvancementEntry[];
  computedSpp?: Record<string, number>;
  onChange?: (next: StagedAdvancementEntry[]) => void;
  disabled?: boolean;
  pairingId?: string;
}) {
  return render(
    <LanguageProvider>
      <SheetAdvancementsEditor
        teamId="team-1"
        ruleset="season_3"
        players={props.players}
        journeymen={props.journeymen}
        computedSpp={props.computedSpp ?? {}}
        sppBonus={[]}
        staged={props.staged ?? []}
        onChange={props.onChange ?? (() => undefined)}
        disabled={props.disabled}
        pairingId={props.pairingId}
      />
    </LanguageProvider>,
  );
}

describe("SheetAdvancementsEditor (staging feuille de match)", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation((path: string) => {
      if (path.includes("/api/skills"))
        return Promise.resolve({
          skills: [
            { slug: "block", nameFr: "Blocage", category: "General" },
            { slug: "dodge", nameFr: "Esquive", category: "Agility" },
          ],
        });
      return Promise.resolve({});
    });
  });

  it("liste les joueurs atteignant un palier avec leur PSP PROJETÉ (actuel + match)", async () => {
    setup({
      // 2 PSP en banque + 4 gagnés ce match = 6 projetés (≥ 3, palier
      // le moins cher). L'autre joueur (0 + 1) n'atteint rien.
      players: [
        player({ id: "p1", name: "Griff", spp: 2 }),
        player({ id: "p2", name: "Zug", spp: 0 }),
      ],
      computedSpp: { p1: 4, p2: 1 },
    });
    const list = await screen.findByTestId("sheet-advancements-list");
    expect(list.textContent).toContain("Griff");
    expect(list.textContent).toContain("6 PSP");
    expect(list.textContent).not.toContain("Zug");
  });

  it("stage un choix de compétence via onChange, sans POST advancement", async () => {
    const onChange = vi.fn();
    setup({
      players: [player({ id: "p1", name: "Griff", spp: 10 })],
      onChange,
    });
    await screen.findByTestId("level-up-row-p1");
    // Type « Principale » puis choix d'une compétence du pool (G).
    fireEvent.click(screen.getByTestId("level-up-type-primary-p1"));
    fireEvent.click(await screen.findByTestId("level-up-skill-block-p1"));
    fireEvent.click(screen.getByTestId("level-up-apply-p1"));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        { playerId: "p1", type: "primary", skillSlug: "block" },
      ]),
    );
    // AUCUNE application directe au roster : pas de POST /advancement.
    expect(
      apiRequest.mock.calls.some(
        ([path, init]) =>
          String(path).includes("/advancement") &&
          (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  });

  it("affiche l'entrée stagée avec retrait possible", async () => {
    const onChange = vi.fn();
    setup({
      players: [player({ id: "p1", name: "Griff", spp: 10 })],
      staged: [{ playerId: "p1", type: "primary", skillSlug: "block" }],
      onChange,
    });
    const banner = await screen.findByTestId("level-up-staged-p1");
    expect(banner.textContent).toContain("Blocage");
    expect(banner.textContent).toContain("validation du commissaire");
    fireEvent.click(screen.getByTestId("level-up-unstage-p1"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("verrouille le retrait quand la saisie du côté est validée", async () => {
    setup({
      players: [player({ id: "p1", name: "Griff", spp: 10 })],
      staged: [{ playerId: "p1", type: "primary", skillSlug: "block" }],
      disabled: true,
    });
    await screen.findByTestId("level-up-staged-p1");
    expect(screen.queryByTestId("level-up-unstage-p1")).toBeNull();
  });

  it("affiche un état vide quand personne n'atteint de palier", async () => {
    setup({ players: [player({ id: "p1", spp: 0 })] });
    expect(
      await screen.findByTestId("sheet-advancements-empty"),
    ).toBeTruthy();
  });

  // Le poste CHOISI pour le journalier (Trois-quart Orque / Gobelin) décide
  // des catégories accessibles : il fait partie du libellé, pour que le
  // coach voie que son changement de poste est bien pris en compte.
  it("liste un journalier atteignant un palier, avec le poste choisi", async () => {
    setup({
      players: [],
      journeymen: [journeyman()],
      computedSpp: { "journeyman-home-1": 3 },
    });
    const row = await screen.findByTestId("level-up-row-journeyman-home-1");
    expect(row.textContent).toContain("N°12 Journalier 1");
    expect(row.textContent).toContain("Journalier (Trois-quart Gobelin)");
    expect(row.textContent).toContain("3 PSP");
  });

  it("n'affiche pas un journalier sous le palier le moins cher", async () => {
    setup({
      players: [],
      journeymen: [journeyman()],
      computedSpp: { "journeyman-home-1": 2 },
    });
    expect(
      await screen.findByTestId("sheet-advancements-empty"),
    ).toBeTruthy();
  });

  // La catégorie « Hasard » n'était pas proposée aux journaliers : le
  // tirage d'équipe exige une ligne TeamPlayer. La feuille le sert.
  it("ouvre le tirage « Hasard » à un journalier, servi par la route de la feuille", async () => {
    const onChange = vi.fn();
    apiRequest.mockImplementation((path: string) => {
      if (path.includes("/api/skills"))
        return Promise.resolve({
          skills: [
            { slug: "catch", nameFr: "Réception", category: "Agility" },
            { slug: "diving-catch", nameFr: "Réception plongeante", category: "Agility" },
          ],
        });
      if (path.includes("/roll-random-primary"))
        return Promise.resolve({ candidates: ["catch", "diving-catch"] });
      return Promise.resolve({});
    });
    setup({
      players: [],
      journeymen: [journeyman()],
      computedSpp: { "journeyman-home-1": 3 },
      pairingId: "pair-1",
      onChange,
    });
    await screen.findByTestId("level-up-row-journeyman-home-1");
    fireEvent.click(
      screen.getByTestId("level-up-type-random-primary-journeyman-home-1"),
    );
    // Agilité est Principale pour un Trois-quart Gobelin (A,K).
    fireEvent.click(screen.getByTestId("level-up-category-A-journeyman-home-1"));
    fireEvent.click(screen.getByTestId("level-up-roll-journeyman-home-1"));
    await screen.findByTestId("level-up-candidates-journeyman-home-1");

    expect(apiRequest).toHaveBeenCalledWith(
      "/leagues/pairings/pair-1/sheet/journeymen/journeyman-home-1/roll-random-primary",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ category: "A" }),
      }),
    );
    // Jamais l'endpoint d'équipe : le journalier n'y existe pas.
    expect(
      apiRequest.mock.calls.some(([path]) => String(path).includes("/team/")),
    ).toBe(false);

    fireEvent.click(
      screen.getByTestId("level-up-candidate-catch-journeyman-home-1"),
    );
    fireEvent.click(screen.getByTestId("level-up-apply-journeyman-home-1"));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        {
          playerId: "journeyman-home-1",
          type: "random-primary",
          category: "A",
          skillSlug: "catch",
        },
      ]),
    );
  });

  it("sans pairing connu (rétro-compat), un journalier n'a que les choix libres", async () => {
    setup({
      players: [],
      journeymen: [journeyman()],
      computedSpp: { "journeyman-home-1": 3 },
    });
    await screen.findByTestId("level-up-row-journeyman-home-1");
    expect(
      screen.queryByTestId("level-up-type-random-primary-journeyman-home-1"),
    ).toBeNull();
    expect(
      screen.getByTestId("level-up-type-primary-journeyman-home-1"),
    ).toBeTruthy();
  });
});

describe("StagedAdvancementsRecap", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation((path: string) => {
      if (path.includes("/api/skills"))
        return Promise.resolve({
          skills: [
            { slug: "block", nameFr: "Blocage", category: "General" },
            { slug: "dodge", nameFr: "Esquive", category: "Agility" },
          ],
        });
      return Promise.resolve({});
    });
  });

  it("affiche le statut appliqué/refusé renvoyé par la validation", async () => {
    render(
      <StagedAdvancementsRecap
        title="Domicile"
        players={[player({ id: "p1", name: "Griff", number: 4 })]}
        entries={[
          {
            playerId: "p1",
            type: "primary",
            skillSlug: "block",
            applied: true,
            cost: 6,
          },
          {
            playerId: "p1",
            type: "secondary",
            skillSlug: "dodge",
            applied: false,
            skipReason: "insufficient-spp",
          },
        ]}
      />,
    );
    const recap = screen.getByTestId("sheet-advancements-recap");
    expect(recap.textContent).toContain("N°4 Griff");
    expect(recap.textContent).toContain("✓ appliqué · 6 PSP");
    expect(recap.textContent).toContain("refusé (insufficient-spp)");
    // Nom FR + catégorie de la compétence, pas le slug brut.
    await waitFor(() => {
      expect(recap.textContent).toContain("Blocage (Générales)");
      expect(recap.textContent).toContain("Esquive (Agilité)");
      expect(recap.textContent).not.toContain("block");
    });
  });

  it("replie sur le slug quand la compétence est absente du catalogue", async () => {
    render(
      <StagedAdvancementsRecap
        title="Domicile"
        players={[player({ id: "p1", name: "Griff", number: 4 })]}
        entries={[
          { playerId: "p1", type: "primary", skillSlug: "mystery-skill" },
        ]}
      />,
    );
    const recap = screen.getByTestId("sheet-advancements-recap");
    expect(recap.textContent).toContain("mystery-skill");
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining("/api/skills"),
        undefined,
      ),
    );
    expect(recap.textContent).toContain("mystery-skill");
  });
});
