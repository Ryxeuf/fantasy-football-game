/**
 * Tests de `TeamDescriptionEditor` (fluff d'équipe sur la fiche d'édition).
 *
 * Couvre :
 *   - saisie → PATCH /team/:id/description, remontée de la valeur PERSISTÉE ;
 *   - effacement (champ vidé) → `null` envoyé, pas une chaîne vide ;
 *   - bouton désarmé tant que rien n'a changé (trim compris) ;
 *   - borne locale (> 1000) → bouton désarmé + message ;
 *   - erreur API → message affiché, brouillon conservé.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("../../../lib/api-client", () => ({ apiRequest: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { apiRequest } from "../../../lib/api-client";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import TeamDescriptionEditor, {
  TEAM_DESCRIPTION_MAX_LENGTH,
} from "./TeamDescriptionEditor";

const mockedApi = vi.mocked(apiRequest);
const TEAM_ID = "team-1";

function renderEditor(initialDescription: string | null = null) {
  const onSaved = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LanguageProvider>{children}</LanguageProvider>
  );
  render(
    <TeamDescriptionEditor
      teamId={TEAM_ID}
      initialDescription={initialDescription}
      onSaved={onSaved}
    />,
    { wrapper },
  );
  return { onSaved };
}

const input = () =>
  screen.getByTestId("team-description-input") as HTMLTextAreaElement;
const saveButton = () =>
  screen.getByTestId("team-description-save") as HTMLButtonElement;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("TeamDescriptionEditor", () => {
  it("enregistre la description et remonte la valeur persistée", async () => {
    mockedApi.mockResolvedValue({
      team: { id: TEAM_ID, description: "Bande de rats" },
    });
    const { onSaved } = renderEditor(null);

    fireEvent.change(input(), { target: { value: "  Bande de rats  " } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(1));
    expect(mockedApi).toHaveBeenCalledWith(
      `/team/${TEAM_ID}/description`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ description: "Bande de rats" }),
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Bande de rats"));
  });

  it("envoie null (et pas une chaîne vide) quand le coach efface", async () => {
    mockedApi.mockResolvedValue({ team: { id: TEAM_ID, description: null } });
    const { onSaved } = renderEditor("Ancien fluff");

    fireEvent.change(input(), { target: { value: "   " } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(1));
    expect(mockedApi).toHaveBeenCalledWith(
      `/team/${TEAM_ID}/description`,
      expect.objectContaining({
        body: JSON.stringify({ description: null }),
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(null));
  });

  it("désarme le bouton tant que rien n'a changé, espaces compris", () => {
    renderEditor("Bande de rats");
    expect(saveButton().disabled).toBe(true);

    fireEvent.change(input(), { target: { value: "  Bande de rats  " } });
    expect(saveButton().disabled).toBe(true);

    fireEvent.change(input(), { target: { value: "Bande de rats vifs" } });
    expect(saveButton().disabled).toBe(false);
  });

  it("désarme le bouton et prévient au-delà de la borne", () => {
    renderEditor(null);

    fireEvent.change(input(), {
      target: { value: "x".repeat(TEAM_DESCRIPTION_MAX_LENGTH + 1) },
    });

    expect(saveButton().disabled).toBe(true);
    expect(screen.getByTestId("team-description-too-long")).toBeTruthy();
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("affiche le compteur de caractères sur la valeur trimée", () => {
    renderEditor(null);
    fireEvent.change(input(), { target: { value: "  abc  " } });
    expect(screen.getByTestId("team-description-counter").textContent).toContain(
      "3",
    );
  });

  it("affiche l'erreur API sans perdre le brouillon", async () => {
    mockedApi.mockRejectedValue(new Error("Boom"));
    renderEditor(null);

    fireEvent.change(input(), { target: { value: "Bande de rats" } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(screen.getByTestId("team-description-error").textContent).toBe(
        "Boom",
      ),
    );
    expect(input().value).toBe("Bande de rats");
  });
});
