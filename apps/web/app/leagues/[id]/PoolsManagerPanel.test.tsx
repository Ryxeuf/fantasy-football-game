/**
 * Panneau commissaire des poules d'une saison de ligue : la composition se
 * fige au démarrage, le quota de qualifiés reste corrigeable jusqu'au bracket
 * (retour commissaire, ligue Kraken), et la création garde le dernier quota
 * saisi.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PoolsManagerPanel } from "./PoolsManagerPanel";
import type { LeaguePool } from "./types";

const apiRequestMock = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

const POOLS: LeaguePool[] = [
  {
    id: "pa",
    name: "Poule A",
    order: 0,
    color: null,
    qualifiesForPlayoffs: 2,
    _count: { participants: 4 },
  },
];

function renderPanel(props: {
  editable: boolean;
  quotaEditable?: boolean;
  pools?: LeaguePool[];
}) {
  const onChanged = vi.fn();
  render(
    <PoolsManagerPanel
      seasonId="S1"
      pools={props.pools ?? POOLS}
      participants={[]}
      editable={props.editable}
      quotaEditable={props.quotaEditable}
      onChanged={onChanged}
    />,
  );
  return { onChanged };
}

beforeEach(() => {
  vi.resetAllMocks();
  apiRequestMock.mockResolvedValue({});
});

describe("PoolsManagerPanel — quota en cours de saison", () => {
  it("laisse corriger le quota d'une saison démarrée, sans rouvrir la composition", async () => {
    const { onChanged } = renderPanel({ editable: false, quotaEditable: true });

    const input = screen.getByTestId("pool-quota-pa") as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(screen.getByTestId("pools-manager-lock").textContent).toMatch(
      /qualifiés modifiables jusqu'au bracket/,
    );
    // Composition figée : ni création, ni suppression, ni affectation.
    expect(screen.queryByTestId("pool-create")).toBeNull();
    expect(screen.queryByTestId("pool-delete-pa")).toBeNull();

    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/leagues/pools/pa", {
        method: "PATCH",
        body: JSON.stringify({ qualifiesForPlayoffs: 4 }),
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("verrouille tout une fois le bracket généré (ou la saison close)", () => {
    renderPanel({ editable: false, quotaEditable: false });

    expect(
      (screen.getByTestId("pool-quota-pa") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.getByTestId("pools-manager-lock").textContent).toBe(
      "Lecture seule",
    );
  });

  it("par défaut, suit la fenêtre de la composition", () => {
    renderPanel({ editable: true });
    expect(
      (screen.getByTestId("pool-quota-pa") as HTMLInputElement).disabled,
    ).toBe(false);
    expect(screen.queryByTestId("pools-manager-lock")).toBeNull();
  });

  it("remet le champ à la valeur du serveur quand le quota est refusé", async () => {
    apiRequestMock.mockRejectedValue(
      new Error(
        "Bracket deja genere : le nombre de qualifies ne gouverne plus rien.",
      ),
    );
    const { onChanged } = renderPanel({ editable: false, quotaEditable: true });

    const input = screen.getByTestId("pool-quota-pa") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);

    expect(await screen.findByText(/Bracket deja genere/)).toBeTruthy();
    await waitFor(() => expect(input.value).toBe("2"));
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("n'envoie rien quand le quota n'a pas changé", () => {
    renderPanel({ editable: false, quotaEditable: true });
    const input = screen.getByTestId("pool-quota-pa");
    fireEvent.blur(input);
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});
