/**
 * Éditeur de date prévisionnelle : ouverture, envoi de la date au format
 * ISO (PATCH …/schedule), retrait (null) et remontée d'erreur.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PairingScheduleEditor } from "./PairingScheduleEditor";
import { LanguageProvider } from "../../contexts/LanguageContext";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

function renderEditor(scheduledAt: string | null, onChanged = vi.fn()) {
  render(
    <LanguageProvider>
      <PairingScheduleEditor
        pairingId="pa1"
        scheduledAt={scheduledAt}
        onChanged={onChanged}
      />
    </LanguageProvider>,
  );
  return onChanged;
}

describe("PairingScheduleEditor", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({});
  });

  it("propose « Planifier » sans date et « Modifier la date » avec", () => {
    renderEditor(null);
    expect(screen.getByTestId("pairing-schedule-open-pa1").textContent).toContain(
      "Planifier",
    );
  });

  it("envoie la date choisie en ISO puis prévient le parent", async () => {
    const onChanged = renderEditor(null);
    fireEvent.click(screen.getByTestId("pairing-schedule-open-pa1"));
    fireEvent.change(screen.getByTestId("pairing-schedule-input-pa1"), {
      target: { value: "2026-09-12T20:30" },
    });
    fireEvent.click(screen.getByTestId("pairing-schedule-save-pa1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const [path, init] = apiRequest.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/leagues/pairings/pa1/schedule");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(String(init.body)) as { scheduledAt: string };
    expect(body.scheduledAt).toBe(new Date("2026-09-12T20:30").toISOString());
  });

  it("retire la date avec null", async () => {
    const onChanged = renderEditor("2026-09-12T18:30:00.000Z");
    fireEvent.click(screen.getByTestId("pairing-schedule-open-pa1"));
    fireEvent.click(screen.getByTestId("pairing-schedule-clear-pa1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const [, init] = apiRequest.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ scheduledAt: null });
  });

  it("affiche l'erreur serveur sans fermer le formulaire", async () => {
    apiRequest.mockRejectedValue(new Error("Rencontre déjà jouée"));
    const onChanged = renderEditor(null);
    fireEvent.click(screen.getByTestId("pairing-schedule-open-pa1"));
    fireEvent.change(screen.getByTestId("pairing-schedule-input-pa1"), {
      target: { value: "2026-09-12T20:30" },
    });
    fireEvent.click(screen.getByTestId("pairing-schedule-save-pa1"));
    await waitFor(() =>
      expect(screen.getByTestId("pairing-schedule-error-pa1").textContent).toContain(
        "déjà jouée",
      ),
    );
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByTestId("pairing-schedule-form-pa1")).toBeTruthy();
  });
});
