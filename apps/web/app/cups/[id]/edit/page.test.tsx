import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cup-1" }),
  useRouter: () => ({ push, back: vi.fn() }),
}));

const apiRequest = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  ApiClientError: class extends Error {},
}));

import CupEditPage from "./page";

const CUP = {
  id: "cup-1",
  name: "NAF World Cup",
  description: "Le grand tournoi",
  isPublic: true,
  status: "ouverte",
  isCreator: true,
  scoringConfig: {
    winPoints: 1000,
    drawPoints: 400,
    lossPoints: 0,
    forfeitPoints: -100,
    touchdownPoints: 5,
    blockCasualtyPoints: 3,
    foulCasualtyPoints: 2,
    passPoints: 2,
  },
  tieBreakRules: ["points", "td_diff"],
};

describe("édition d'une coupe", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    push.mockReset();
  });

  it("préremplit le formulaire depuis la coupe", async () => {
    apiRequest.mockResolvedValue({ cup: CUP });
    render(<CupEditPage />);
    await screen.findByTestId("cup-edit");
    expect((screen.getByTestId("cup-edit-name") as HTMLInputElement).value).toBe(
      "NAF World Cup",
    );
    expect(
      (screen.getByTestId("cup-edit-winPoints") as HTMLInputElement).value,
    ).toBe("1000");
    expect(screen.getByTestId("cup-tiebreak-editor").textContent).toContain(
      "Différence de TD",
    );
  });

  it("refuse l'écran à qui n'est pas commissaire", async () => {
    apiRequest.mockResolvedValue({ cup: { ...CUP, isCreator: false } });
    render(<CupEditPage />);
    expect(await screen.findByTestId("cup-edit-forbidden")).toBeTruthy();
  });

  it("réordonne les critères et enregistre l'ordre choisi", async () => {
    apiRequest.mockResolvedValue({ cup: CUP });
    render(<CupEditPage />);
    await screen.findByTestId("cup-edit");

    fireEvent.click(screen.getByTestId("cup-tiebreak-add-cas_for"));
    fireEvent.click(screen.getByTestId("cup-tiebreak-up-cas_for"));
    fireEvent.click(screen.getByTestId("cup-edit-submit"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/cups/cup-1"));
    const patch = apiRequest.mock.calls.find(
      (c) => (c[1] as { method?: string } | undefined)?.method === "PATCH",
    );
    expect(patch).toBeTruthy();
    const body = JSON.parse((patch![1] as { body: string }).body);
    expect(body.tieBreakRules).toEqual(["points", "cas_for", "td_diff"]);
    expect(body).toMatchObject({ name: "NAF World Cup", winPoints: 1000 });
  });

  it("envoie `null` quand plus aucun critère n'est retenu (ordre par défaut)", async () => {
    apiRequest.mockResolvedValue({ cup: CUP });
    render(<CupEditPage />);
    await screen.findByTestId("cup-edit");

    fireEvent.click(screen.getByTestId("cup-tiebreak-remove-points"));
    fireEvent.click(screen.getByTestId("cup-tiebreak-remove-td_diff"));
    fireEvent.click(screen.getByTestId("cup-edit-submit"));

    await waitFor(() => expect(push).toHaveBeenCalled());
    const patch = apiRequest.mock.calls.find(
      (c) => (c[1] as { method?: string } | undefined)?.method === "PATCH",
    );
    expect(JSON.parse((patch![1] as { body: string }).body).tieBreakRules).toBeNull();
  });

  it("affiche l'erreur serveur sans quitter l'écran", async () => {
    apiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (init?.method === "PATCH") return Promise.reject(new Error("Coupe archivée"));
      return Promise.resolve({ cup: CUP });
    });
    render(<CupEditPage />);
    await screen.findByTestId("cup-edit");
    fireEvent.click(screen.getByTestId("cup-edit-submit"));
    await waitFor(() =>
      expect(screen.getByTestId("cup-edit-error").textContent).toContain(
        "Coupe archivée",
      ),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
