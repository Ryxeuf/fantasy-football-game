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
import type { SheetPlayer } from "./MatchSheetPanels";

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

function setup(props: {
  players: SheetPlayer[];
  staged?: StagedAdvancementEntry[];
  computedSpp?: Record<string, number>;
  onChange?: (next: StagedAdvancementEntry[]) => void;
  disabled?: boolean;
}) {
  return render(
    <LanguageProvider>
      <SheetAdvancementsEditor
        teamId="team-1"
        ruleset="season_3"
        players={props.players}
        computedSpp={props.computedSpp ?? {}}
        sppBonus={[]}
        staged={props.staged ?? []}
        onChange={props.onChange ?? (() => undefined)}
        disabled={props.disabled}
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
