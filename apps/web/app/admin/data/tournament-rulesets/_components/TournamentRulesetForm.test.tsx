/**
 * Formulaire admin des règlements de tournoi :
 * - la table des règles par roster vient de /api/rosters (édition choisie) ;
 * - un roster décoché est absent du payload (interdit par le règlement) ;
 * - les champs CSV (stars bannies, compétences Élite) sont parsés au submit ;
 * - submit bloqué tant qu'aucun roster n'est autorisé ; slug désactivé en
 *   édition.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { TournamentRulesetForm } from "./TournamentRulesetForm";
import type { TournamentRulesetFormValues } from "../api";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      rosters: [
        { slug: "orc", name: "Orcs" },
        { slug: "skaven", name: "Skavens" },
      ],
    }),
  } as unknown as Response) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

const BASE_INITIAL: Partial<TournamentRulesetFormValues> = {
  slug: "coupe_maison",
  nameFr: "Coupe Maison",
  nameEn: "House Cup",
  shortLabel: "Coupe Maison",
  version: "V1",
};

describe("TournamentRulesetForm", () => {
  it("submit bloqué sans roster autorisé, payload construit après cochage + CSV parsés", async () => {
    const onSubmit = vi.fn();
    render(
      <TournamentRulesetForm
        mode="create"
        initial={BASE_INITIAL}
        submitting={false}
        error={null}
        submitLabel="Créer"
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("pack-roster-toggle-orc")).toBeTruthy(),
    );

    const submit = screen.getByTestId("pack-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByTestId("pack-roster-toggle-orc"));
    expect(submit.disabled).toBe(false);

    fireEvent.change(screen.getByTestId("pack-banned-stars-input"), {
      target: { value: "morg_n_thorg,  griff_oberwald " },
    });

    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as TournamentRulesetFormValues;
    expect(Object.keys(payload.rosterRules)).toEqual(["orc"]);
    expect(payload.rosterRules.orc.goldBudget).toBeGreaterThan(0);
    expect(payload.bannedStarPlayers).toEqual([
      "morg_n_thorg",
      "griff_oberwald",
    ]);
    expect(payload.slug).toBe("coupe_maison");
  });

  it("mode édition : slug désactivé (immuable)", async () => {
    render(
      <TournamentRulesetForm
        mode="edit"
        initial={{
          ...BASE_INITIAL,
          rosterRules: {
            orc: {
              goldBudget: 1100,
              sppBudget: 50,
              skillStacking: "none",
              starPlayersAllowed: false,
            },
          },
        }}
        submitting={false}
        error={null}
        submitLabel="Sauvegarder"
        onSubmit={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("pack-roster-toggle-orc")).toBeTruthy(),
    );
    const slugInput = screen.getByTestId("pack-slug-input") as HTMLInputElement;
    expect(slugInput.disabled).toBe(true);
    expect(slugInput.value).toBe("coupe_maison");
  });

  it("décocher un roster le retire du payload", async () => {
    const onSubmit = vi.fn();
    render(
      <TournamentRulesetForm
        mode="edit"
        initial={{
          ...BASE_INITIAL,
          rosterRules: {
            orc: {
              goldBudget: 1100,
              sppBudget: 50,
              skillStacking: "none",
              starPlayersAllowed: false,
            },
            skaven: {
              goldBudget: 1080,
              sppBudget: 44,
              skillStacking: "none",
              starPlayersAllowed: false,
            },
          },
        }}
        submitting={false}
        error={null}
        submitLabel="Sauvegarder"
        onSubmit={onSubmit}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("pack-roster-toggle-skaven")).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId("pack-roster-toggle-skaven"));
    fireEvent.click(screen.getByTestId("pack-submit"));
    const payload = onSubmit.mock.calls[0][0] as TournamentRulesetFormValues;
    expect(Object.keys(payload.rosterRules)).toEqual(["orc"]);
  });
});
