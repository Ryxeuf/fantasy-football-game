/**
 * Tests de `TeamNameInlineEdit` (renommage d'équipe depuis la fiche).
 *
 * Couvre :
 *   - affichage du nom + crayon, ouverture du champ ;
 *   - renommage → PATCH /team/:id/name, remontée du nom PERSISTÉ ;
 *   - bornes locales (vide / > 100) → bouton désarmé + message ;
 *   - nom inchangé → aucun appel réseau ;
 *   - erreur API → message affiché, champ toujours ouvert ;
 *   - Échap ferme sans enregistrer.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("../../../lib/api-client", () => ({ apiRequest: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { apiRequest } from "../../../lib/api-client";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { TeamNameInlineEdit } from "./TeamNameInlineEdit";

const mockedApi = vi.mocked(apiRequest);
const TEAM_ID = "team-1";

function renderEditor(name = "Les Bourrins") {
  const onRenamed = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LanguageProvider>{children}</LanguageProvider>
  );
  render(
    <TeamNameInlineEdit teamId={TEAM_ID} name={name} onRenamed={onRenamed} />,
    { wrapper },
  );
  return { onRenamed };
}

function openEditor(name?: string) {
  const ctx = renderEditor(name);
  fireEvent.click(screen.getByTestId("team-name-edit"));
  return ctx;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("TeamNameInlineEdit", () => {
  it("affiche le nom et ouvre le champ au clic sur le crayon", () => {
    renderEditor();
    expect(screen.getByText("Les Bourrins")).toBeTruthy();

    fireEvent.click(screen.getByTestId("team-name-edit"));

    const input = screen.getByTestId("team-name-input") as HTMLInputElement;
    expect(input.value).toBe("Les Bourrins");
  });

  it("renomme via PATCH et remonte le nom renvoyé par le serveur", async () => {
    mockedApi.mockResolvedValueOnce({
      team: { id: TEAM_ID, name: "Les Crânes Fêlés" },
    });
    const { onRenamed } = openEditor();

    fireEvent.change(screen.getByTestId("team-name-input"), {
      target: { value: "  Les Crânes Fêlés  " },
    });
    fireEvent.click(screen.getByTestId("team-name-save"));

    await waitFor(() =>
      expect(onRenamed).toHaveBeenCalledWith("Les Crânes Fêlés"),
    );
    expect(mockedApi).toHaveBeenCalledWith(`/team/${TEAM_ID}/name`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Les Crânes Fêlés" }),
    });
    // Le champ se referme sur succès.
    expect(screen.queryByTestId("team-name-input")).toBeNull();
  });

  it("valide aussi à la touche Entrée", async () => {
    mockedApi.mockResolvedValueOnce({
      team: { id: TEAM_ID, name: "Nurgle FC" },
    });
    const { onRenamed } = openEditor();

    const input = screen.getByTestId("team-name-input");
    fireEvent.change(input, { target: { value: "Nurgle FC" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith("Nurgle FC"));
  });

  it("désarme le bouton et explique quand le nom est vide", () => {
    openEditor();

    fireEvent.change(screen.getByTestId("team-name-input"), {
      target: { value: "   " },
    });

    expect(
      (screen.getByTestId("team-name-save") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/ne peut pas être vide/i)).toBeTruthy();
  });

  it("désarme le bouton au-delà de 100 caractères", () => {
    openEditor();

    fireEvent.change(screen.getByTestId("team-name-input"), {
      target: { value: "a".repeat(101) },
    });

    expect(
      (screen.getByTestId("team-name-save") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/100 caractères/i)).toBeTruthy();
  });

  it("n'appelle pas l'API quand le nom n'a pas changé", async () => {
    const { onRenamed } = openEditor();

    fireEvent.click(screen.getByTestId("team-name-save"));

    await waitFor(() =>
      expect(screen.queryByTestId("team-name-input")).toBeNull(),
    );
    expect(mockedApi).not.toHaveBeenCalled();
    expect(onRenamed).not.toHaveBeenCalled();
  });

  it("affiche l'erreur serveur et garde le champ ouvert", async () => {
    mockedApi.mockRejectedValueOnce(new Error("Équipe introuvable"));
    const { onRenamed } = openEditor();

    fireEvent.change(screen.getByTestId("team-name-input"), {
      target: { value: "Autre nom" },
    });
    fireEvent.click(screen.getByTestId("team-name-save"));

    await waitFor(() =>
      expect(screen.getByTestId("team-name-error").textContent).toBe(
        "Équipe introuvable",
      ),
    );
    expect(onRenamed).not.toHaveBeenCalled();
    expect(screen.getByTestId("team-name-input")).toBeTruthy();
  });

  it("Échap ferme sans enregistrer", () => {
    const { onRenamed } = openEditor();

    const input = screen.getByTestId("team-name-input");
    fireEvent.change(input, { target: { value: "Jamais enregistré" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByTestId("team-name-input")).toBeNull();
    expect(mockedApi).not.toHaveBeenCalled();
    expect(onRenamed).not.toHaveBeenCalled();
    expect(screen.getByText("Les Bourrins")).toBeTruthy();
  });

  it("annule via le bouton Annuler", () => {
    openEditor();

    fireEvent.click(screen.getByTestId("team-name-cancel"));

    expect(screen.queryByTestId("team-name-input")).toBeNull();
    expect(mockedApi).not.toHaveBeenCalled();
  });
});
