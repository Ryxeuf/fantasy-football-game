/**
 * Poules d'une coupe : création, quota, suppression, affectation manuelle et
 * répartition automatique — et la bascule en lecture seule dès la première
 * ronde, qui est ce qui protège un classement déjà joué.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CupPoolsManagerPanel, {
  type CupPoolParticipant,
  type CupPoolView,
} from "./CupPoolsManagerPanel";
import { LanguageProvider } from "../../contexts/LanguageContext";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

const POOLS: CupPoolView[] = [
  {
    id: "pool-a",
    name: "Poule A",
    order: 0,
    color: null,
    qualifiesForPlayoffs: 2,
    participantCount: 2,
  },
  {
    id: "pool-b",
    name: "Poule B",
    order: 1,
    color: null,
    qualifiesForPlayoffs: 2,
    participantCount: 0,
  },
];

const PARTICIPANTS: CupPoolParticipant[] = [
  { participantId: "cp1", teamName: "Reikland", poolId: "pool-a" },
  { participantId: "cp2", teamName: "Skavenblight", poolId: null },
];

function renderPanel(
  over: { editable?: boolean; pools?: CupPoolView[] } = {},
) {
  const onChanged = vi.fn();
  apiRequest.mockResolvedValue({ pools: over.pools ?? POOLS });
  const utils = render(
    <LanguageProvider>
      <CupPoolsManagerPanel
        cupId="cup-1"
        participants={PARTICIPANTS}
        editable={over.editable ?? true}
        onChanged={onChanged}
      />
    </LanguageProvider>,
  );
  return { ...utils, onChanged };
}

/**
 * Appel MUTANT retrouvé par son chemin. Filtre sur la présence d'un `init` :
 * la création partage son chemin avec le GET de rechargement, qui n'en a pas.
 */
function callTo(path: string) {
  return apiRequest.mock.calls.find(([p, init]) => p === path && Boolean(init));
}

beforeEach(() => vi.resetAllMocks());

describe("CupPoolsManagerPanel", () => {
  it("liste les poules avec leur effectif et leur quota", async () => {
    renderPanel();
    await screen.findByTestId("cup-pool-row-pool-a");
    expect(screen.getByTestId("cup-pool-row-pool-a").textContent).toContain(
      "Poule A",
    );
    expect(
      (screen.getByTestId("cup-pool-qualifies-pool-a") as HTMLInputElement)
        .value,
    ).toBe("2");
  });

  it("crée une poule avec son quota", async () => {
    renderPanel();
    await screen.findByTestId("cup-pool-create");
    fireEvent.change(screen.getByTestId("cup-pool-name"), {
      target: { value: "Poule C" },
    });
    fireEvent.change(screen.getByTestId("cup-pool-new-qualifies"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByTestId("cup-pool-create"));
    await waitFor(() => expect(callTo("/cup/cup-1/pools")).toBeTruthy());
    expect(
      JSON.parse((callTo("/cup/cup-1/pools")![1] as { body: string }).body),
    ).toEqual({ name: "Poule C", qualifiesForPlayoffs: 1 });
  });

  it("n'envoie rien pour un nom vide", async () => {
    renderPanel();
    await screen.findByTestId("cup-pool-create");
    expect(
      (screen.getByTestId("cup-pool-create") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("modifie le quota d'une poule à la sortie du champ, et seulement s'il change", async () => {
    renderPanel();
    const input = await screen.findByTestId("cup-pool-qualifies-pool-a");
    fireEvent.blur(input, { target: { value: "2" } });
    expect(callTo("/cup/pools/pool-a")).toBeUndefined();

    fireEvent.blur(input, { target: { value: "3" } });
    await waitFor(() => expect(callTo("/cup/pools/pool-a")).toBeTruthy());
    expect(
      JSON.parse((callTo("/cup/pools/pool-a")![1] as { body: string }).body),
    ).toEqual({ qualifiesForPlayoffs: 3 });
  });

  it("supprime une poule après confirmation seulement", async () => {
    renderPanel();
    await screen.findByTestId("cup-pool-delete-pool-b");
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    fireEvent.click(screen.getByTestId("cup-pool-delete-pool-b"));
    expect(callTo("/cup/pools/pool-b")).toBeUndefined();

    fireEvent.click(screen.getByTestId("cup-pool-delete-pool-b"));
    await waitFor(() => expect(callTo("/cup/pools/pool-b")).toBeTruthy());
    expect((callTo("/cup/pools/pool-b")![1] as { method: string }).method).toBe(
      "DELETE",
    );
    confirmSpy.mockRestore();
  });

  it("n'envoie QUE les affectations modifiées", async () => {
    renderPanel();
    await screen.findByTestId("cup-pool-assign-cp2");
    fireEvent.change(screen.getByTestId("cup-pool-assign-cp2"), {
      target: { value: "pool-b" },
    });
    fireEvent.click(screen.getByTestId("cup-pool-save-assignments"));
    await waitFor(() => expect(callTo("/cup/cup-1/pools/assign")).toBeTruthy());
    expect(
      JSON.parse(
        (callTo("/cup/cup-1/pools/assign")![1] as { body: string }).body,
      ),
    ).toEqual({
      assignments: [{ participantId: "cp2", poolId: "pool-b" }],
    });
  });

  it("désaffecte une équipe (poolId null)", async () => {
    renderPanel();
    await screen.findByTestId("cup-pool-assign-cp1");
    fireEvent.change(screen.getByTestId("cup-pool-assign-cp1"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByTestId("cup-pool-save-assignments"));
    await waitFor(() => expect(callTo("/cup/cup-1/pools/assign")).toBeTruthy());
    expect(
      JSON.parse(
        (callTo("/cup/cup-1/pools/assign")![1] as { body: string }).body,
      ),
    ).toEqual({ assignments: [{ participantId: "cp1", poolId: null }] });
  });

  it("laisse le bouton d'enregistrement inerte sans changement", async () => {
    renderPanel();
    await screen.findByTestId("cup-pool-save-assignments");
    expect(
      (screen.getByTestId("cup-pool-save-assignments") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("répartit automatiquement", async () => {
    renderPanel();
    await screen.findByTestId("cup-pool-auto-assign");
    fireEvent.click(screen.getByTestId("cup-pool-auto-assign"));
    await waitFor(() =>
      expect(callTo("/cup/cup-1/pools/auto-assign")).toBeTruthy(),
    );
  });

  it("refuse la répartition automatique sans aucune poule", async () => {
    renderPanel({ pools: [] });
    await screen.findByTestId("cup-pool-auto-assign");
    expect(
      (screen.getByTestId("cup-pool-auto-assign") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("passe en lecture seule dès la première ronde : plus de création ni d'affectation", async () => {
    renderPanel({ editable: false });
    await screen.findByTestId("cup-pool-row-pool-a");
    expect(screen.queryByTestId("cup-pool-create")).toBeNull();
    expect(screen.queryByTestId("cup-pool-assign-cp1")).toBeNull();
    expect(screen.queryByTestId("cup-pool-delete-pool-a")).toBeNull();
    // Le QUOTA reste modifiable : il ne sert qu'au seeding, encore à venir.
    expect(screen.getByTestId("cup-pool-qualifies-pool-a")).toBeTruthy();
  });

  it("remonte l'erreur d'une mutation refusée", async () => {
    renderPanel();
    await screen.findByTestId("cup-pool-create");
    apiRequest.mockRejectedValueOnce(new Error("Coupe déjà démarrée"));
    fireEvent.change(screen.getByTestId("cup-pool-name"), {
      target: { value: "Poule C" },
    });
    fireEvent.click(screen.getByTestId("cup-pool-create"));
    expect((await screen.findByTestId("cup-pools-error")).textContent).toBe(
      "Coupe déjà démarrée",
    );
  });

  it("affiche un panneau vide plutôt qu'une erreur quand la coupe n'a pas de poule", async () => {
    const onChanged = vi.fn();
    apiRequest.mockRejectedValue(new Error("404"));
    render(
      <LanguageProvider>
        <CupPoolsManagerPanel
          cupId="cup-1"
          participants={PARTICIPANTS}
          editable
          onChanged={onChanged}
        />
      </LanguageProvider>,
    );
    await screen.findByTestId("cup-pools-manager");
    expect(screen.queryByTestId("cup-pools-error")).toBeNull();
  });
});
