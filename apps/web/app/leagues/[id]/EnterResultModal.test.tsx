import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "../../lib/api-client";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { EnterResultModal } from "./EnterResultModal";

const mockedApi = apiRequest as unknown as ReturnType<typeof vi.fn>;

function renderModal() {
  const onClose = vi.fn();
  const onRecorded = vi.fn();
  render(
    <LanguageProvider>
      <EnterResultModal
        pairingId="pair-1"
        homeName="Orcs"
        awayName="Elfes"
        onClose={onClose}
        onRecorded={onRecorded}
      />
    </LanguageProvider>,
  );
  return { onClose, onRecorded };
}

describe("EnterResultModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POST le score + casualties saisis puis declenche le refresh", async () => {
    mockedApi.mockResolvedValue({ recorded: true });
    const { onClose, onRecorded } = renderModal();

    fireEvent.change(screen.getByTestId("result-td-home"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByTestId("result-td-away"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByTestId("result-cas-home"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByTestId("result-cas-away"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByTestId("enter-result-submit"));

    await waitFor(() => expect(mockedApi).toHaveBeenCalledTimes(1));
    const [path, init] = mockedApi.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/leagues/pairings/pair-1/result");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 3,
      casualtiesAway: 0,
    });
    await waitFor(() => expect(onRecorded).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("clamp les valeurs negatives a 0", async () => {
    mockedApi.mockResolvedValue({ recorded: true });
    renderModal();
    fireEvent.change(screen.getByTestId("result-td-home"), {
      target: { value: "-5" },
    });
    fireEvent.click(screen.getByTestId("enter-result-submit"));
    await waitFor(() => expect(mockedApi).toHaveBeenCalled());
    const [, init] = mockedApi.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).scoreHome).toBe(0);
  });

  it("affiche une erreur si la requete echoue", async () => {
    mockedApi.mockRejectedValue(new Error("boom"));
    renderModal();
    fireEvent.click(screen.getByTestId("enter-result-submit"));
    await waitFor(() =>
      expect(screen.getByTestId("enter-result-error")).toBeTruthy(),
    );
  });
});
