/**
 * Recrutement / retrait de Star Players depuis la fiche d'édition.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TeamStarPlayersEditor from "./TeamStarPlayersEditor";
import { LanguageProvider } from "../../../../contexts/LanguageContext";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const apiRequest = vi.fn();
vi.mock("../../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

const GRIFF = {
  slug: "griff_oberwald",
  displayName: "Griff Oberwald",
  cost: 280000,
  ma: 7,
  st: 4,
  ag: 2,
  pa: 3,
  av: 9,
  skills: "block",
  hirableBy: ["all"],
};

const MORG = {
  ...GRIFF,
  slug: "morg_n_thorg",
  displayName: "Morg 'n' Thorg",
  cost: 380000,
};

/** État serveur simulé : Griff est déjà recruté. */
function wireApi(overrides: { hired?: unknown[] } = {}) {
  const hired = overrides.hired ?? [
    { id: "sp-1", slug: "griff_oberwald", cost: 280000 },
  ];
  apiRequest.mockImplementation((path: string) => {
    if (path.endsWith("/available-star-players")) {
      return Promise.resolve({
        currentPlayerCount: 11,
        currentStarPlayerCount: hired.length,
        totalPlayers: 11 + hired.length,
        maxPlayers: 16,
        availableBudget: 300, // K po
      });
    }
    if (path.endsWith("/star-players")) {
      return Promise.resolve({ starPlayers: hired });
    }
    return Promise.resolve({});
  });
  return hired;
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ starPlayers: [GRIFF, MORG] }),
    } as Response),
  );
});

function renderEditor(props: Record<string, unknown> = {}) {
  return render(
    <LanguageProvider>
      <TeamStarPlayersEditor
        teamId="T1"
        roster="human"
        ruleset="season_3"
        {...props}
      />
    </LanguageProvider>,
  );
}

describe("TeamStarPlayersEditor", () => {
  it("coche les Star Players déjà recrutés", async () => {
    wireApi();
    renderEditor();
    await waitFor(() =>
      expect(
        (screen.getByTestId("star-player-griff_oberwald") as HTMLInputElement)
          .checked,
      ).toBe(true),
    );
    expect(
      (screen.getByTestId("star-player-morg_n_thorg") as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  it("recrute via POST quand on coche une nouvelle recrue", async () => {
    wireApi({ hired: [] });
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("star-player-griff_oberwald")).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId("star-player-griff_oberwald"));

    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(
          (call: any[]) =>
            call[0] === "/team/T1/star-players" && call[1]?.method === "POST",
        ),
      ).toBe(true),
    );
    const [, init] = apiRequest.mock.calls.find(
      (call: any[]) =>
        call[0] === "/team/T1/star-players" && call[1]?.method === "POST",
    )!;
    expect(JSON.parse(String(init.body))).toEqual({
      starPlayerSlug: "griff_oberwald",
    });
  });

  it("retire via DELETE sur l'id de la recrue quand on décoche", async () => {
    wireApi();
    renderEditor();
    await waitFor(() =>
      expect(
        (screen.getByTestId("star-player-griff_oberwald") as HTMLInputElement)
          .checked,
      ).toBe(true),
    );

    fireEvent.click(screen.getByTestId("star-player-griff_oberwald"));

    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(
          (call: any[]) =>
            call[0] === "/team/T1/star-players/sp-1" &&
            call[1]?.method === "DELETE",
        ),
      ).toBe(true),
    );
  });

  it("affiche le refus du serveur et resynchronise", async () => {
    wireApi({ hired: [] });
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("star-player-griff_oberwald")).toBeTruthy(),
    );

    apiRequest.mockImplementationOnce(() =>
      Promise.reject(new Error("Budget insuffisant")),
    );
    fireEvent.click(screen.getByTestId("star-player-griff_oberwald"));

    await waitFor(() =>
      expect(screen.getByTestId("team-star-players-error").textContent).toContain(
        "Budget insuffisant",
      ),
    );
  });

  it("recrédite les recrues en place dans le budget du sélecteur", async () => {
    // 300K disponibles + 280K déjà engagés sur Griff = 580K : Morg (380K)
    // reste donc atteignable si l'on décoche Griff, mais pas en plus de lui.
    wireApi();
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("star-player-morg_n_thorg")).toBeTruthy(),
    );
    // Griff (280K) coché + Morg (380K) = 660K > 580K : Morg est bloqué et la
    // raison est affichée.
    expect(
      screen.getByTestId("star-player-blocked-morg_n_thorg").textContent,
    ).toContain("Budget insuffisant");
  });
});

describe("TeamStarPlayersEditor — repli du bloc", () => {
  it("replie le catalogue et garde le résumé visible", async () => {
    wireApi();
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("star-player-griff_oberwald")).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId("team-star-players-toggle"));

    expect(screen.queryByTestId("star-player-griff_oberwald")).toBeNull();
    // Le coach garde sous les yeux ce qu'il a engagé.
    expect(
      screen.getByTestId("team-star-players-summary").textContent,
    ).toContain("280k po");
    expect(
      screen.getByTestId("team-star-players-toggle").getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("mémorise le repli par équipe", async () => {
    wireApi();
    const { unmount } = renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("star-player-griff_oberwald")).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId("team-star-players-toggle"));
    expect(localStorage.getItem("team_star_players_collapsed:T1")).toBe("1");
    unmount();

    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("team-star-players-toggle")).toBeTruthy(),
    );
    expect(screen.queryByTestId("star-player-griff_oberwald")).toBeNull();
  });

  it("déplié par défaut sans préférence enregistrée", async () => {
    wireApi();
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("star-player-griff_oberwald")).toBeTruthy(),
    );
    expect(
      screen.getByTestId("team-star-players-toggle").getAttribute("aria-expanded"),
    ).toBe("true");
  });
});
