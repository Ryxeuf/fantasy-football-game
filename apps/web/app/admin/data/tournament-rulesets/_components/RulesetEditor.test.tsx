/**
 * L'éditeur ne re-valide rien lui-même : il RESTITUE la validation du
 * serveur. Ce qui doit être vrai, c'est que chaque message arrive au pied du
 * bon champ, que l'onglet concerné se signale, et qu'un refus n'efface pas la
 * saisie en cours.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const validateRuleset = vi.hoisted(() => vi.fn());
vi.mock("../_lib/client", async () => {
  const actual = await vi.importActual<typeof import("../_lib/client")>(
    "../_lib/client",
  );
  return { ...actual, validateRuleset };
});

import { RulesetApiError, type EditableDefinition } from "../_lib/client";
import RulesetEditor from "./RulesetEditor";

const DEF: EditableDefinition = {
  slug: "coupe_maison",
  nameFr: "Coupe Maison",
  nameEn: "House Cup",
  shortLabel: "Coupe Maison",
  version: "V1",
  edition: "season_3",
  format: "bb11",
  descriptionFr: "",
  resurrection: true,
  minRegularPlayersBeforeStars: 11,
  rosterRules: {
    orc: {
      goldBudget: 1080,
      sppBudget: 44,
      skillStacking: "none",
      starPlayersAllowed: false,
    },
  },
  skillCosts: {
    firstPrimary: 6,
    firstSecondary: 10,
    secondPrimary: 8,
    secondSecondary: 12,
    eliteSurcharge: 2,
  },
  eliteSkills: [],
  bannedStarPlayers: [],
  starPlayerSppTax: [{ maxTotalCostK: null, spp: 18 }],
  allowedInducements: [{ slug: "bribe", cost: 100_000 }],
  scoring: { win: 5, draw: 2, loss: 0, concession: -5 },
};

function renderEditor(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <RulesetEditor
      initial={DEF}
      initialEnabled
      slugLocked
      eliteCatalog={[{ slug: "block", nameFr: "Blocage" }]}
      starCatalog={[{ slug: "morg", name: "Morg" }]}
      onSave={onSave}
      saveLabel="Enregistrer"
    />,
  );
  return onSave;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("validation servie par le serveur", () => {
  it("affiche « valide » quand le serveur accepte", async () => {
    validateRuleset.mockResolvedValue({ valid: true, slug: "coupe_maison" });
    renderEditor();
    fireEvent.click(screen.getByTestId("ruleset-check"));
    await waitFor(() =>
      expect(screen.getByTestId("ruleset-status").textContent).toMatch(
        /valide/i,
      ),
    );
  });

  it("place le message au pied du champ fautif", async () => {
    validateRuleset.mockRejectedValue(
      new RulesetApiError("Définition de règlement invalide", [
        { path: "shortLabel", message: "Libellé court requis" },
      ]),
    );
    renderEditor();
    fireEvent.click(screen.getByTestId("ruleset-check"));
    await waitFor(() =>
      expect(screen.getByTestId("error-shortLabel").textContent).toBe(
        "Libellé court requis",
      ),
    );
  });

  it("signale l'onglet qui porte l'erreur", async () => {
    validateRuleset.mockRejectedValue(
      new RulesetApiError("invalide", [
        { path: "rosterRules.orc.goldBudget", message: "Trop petit" },
      ]),
    );
    renderEditor();
    fireEvent.click(screen.getByTestId("ruleset-check"));
    await waitFor(() =>
      expect(
        screen
          .getByTestId("tab-rosters")
          .querySelector('[aria-label="contient une erreur"]'),
      ).toBeTruthy(),
    );
    // L'onglet Classement, lui, reste propre.
    expect(
      screen
        .getByTestId("tab-scoring")
        .querySelector('[aria-label="contient une erreur"]'),
    ).toBeNull();
  });

  it("l'erreur apparaît sur le champ une fois l'onglet ouvert", async () => {
    validateRuleset.mockRejectedValue(
      new RulesetApiError("invalide", [
        { path: "scoring.win", message: "Trop grand" },
      ]),
    );
    renderEditor();
    fireEvent.click(screen.getByTestId("ruleset-check"));
    await waitFor(() => expect(screen.getByTestId("ruleset-error")).toBeTruthy());
    fireEvent.click(screen.getByTestId("tab-scoring"));
    expect(screen.getByTestId("error-scoring.win").textContent).toBe(
      "Trop grand",
    );
  });
});

describe("enregistrement", () => {
  it("transmet la définition et l'état d'activation", async () => {
    const onSave = renderEditor();
    fireEvent.click(screen.getByTestId("ruleset-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].slug).toBe("coupe_maison");
    expect(onSave.mock.calls[0][1]).toBe(true);
  });

  it("un refus serveur n'efface pas la saisie", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new RulesetApiError("Définition de règlement invalide", [
          { path: "nameFr", message: "Libellé requis" },
        ]),
      );
    renderEditor(onSave);
    const input = screen.getByTestId("field-nameFr").querySelector("input")!;
    fireEvent.change(input, { target: { value: "Coupe Modifiée" } });
    fireEvent.click(screen.getByTestId("ruleset-save"));
    await waitFor(() =>
      expect(screen.getByTestId("error-nameFr").textContent).toBe(
        "Libellé requis",
      ),
    );
    expect(
      (screen.getByTestId("field-nameFr").querySelector("input") as HTMLInputElement)
        .value,
    ).toBe("Coupe Modifiée");
  });

  it("le slug est verrouillé en édition", () => {
    renderEditor();
    expect(
      (screen.getByTestId("field-slug-input") as HTMLInputElement).disabled,
    ).toBe(true);
  });
});

describe("onglet JSON", () => {
  it("applique un JSON collé au formulaire sans enregistrer", async () => {
    const onSave = renderEditor();
    fireEvent.click(screen.getByTestId("tab-json"));
    fireEvent.change(screen.getByTestId("ruleset-json"), {
      target: {
        value: JSON.stringify({ ...DEF, nameFr: "Depuis le JSON" }),
      },
    });
    fireEvent.click(screen.getByTestId("ruleset-json-apply"));
    await waitFor(() =>
      expect(screen.getByTestId("ruleset-status").textContent).toMatch(
        /JSON appliqué/,
      ),
    );
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("tab-identity"));
    expect(
      (screen.getByTestId("field-nameFr").querySelector("input") as HTMLInputElement)
        .value,
    ).toBe("Depuis le JSON");
  });

  it("refuse un JSON illisible", async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId("tab-json"));
    fireEvent.change(screen.getByTestId("ruleset-json"), {
      target: { value: "{pas du json" },
    });
    fireEvent.click(screen.getByTestId("ruleset-json-apply"));
    await waitFor(() =>
      expect(screen.getByTestId("ruleset-error").textContent).toMatch(
        /JSON illisible/,
      ),
    );
  });
});

describe("tiers par roster", () => {
  it("ajoute et retire un roster", async () => {
    const onSave = renderEditor();
    fireEvent.click(screen.getByTestId("tab-rosters"));
    expect(screen.getByTestId("roster-row-orc")).toBeTruthy();

    fireEvent.change(screen.getByTestId("roster-rules-add-select"), {
      target: { value: "human" },
    });
    fireEvent.click(screen.getByTestId("roster-rules-add"));
    await waitFor(() =>
      expect(screen.getByTestId("roster-row-human")).toBeTruthy(),
    );

    // Retire le roster tout juste ajouté (deux lignes présentes).
    fireEvent.click(
      screen.getByRole("button", { name: /Retirer Humains|Retirer human/ }),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("roster-row-human")).toBeNull(),
    );

    fireEvent.click(screen.getByTestId("ruleset-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(Object.keys(onSave.mock.calls[0][0].rosterRules)).toEqual(["orc"]);
  });
});
