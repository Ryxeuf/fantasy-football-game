/**
 * Bracket de play-offs d'une coupe : panneau de lancement (commissaire
 * seul), publication, édition des têtes de série et rendu des tours.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CupPlayoffBracketView, {
  type CupBracketResponse,
  type CupBracketRound,
} from "./CupPlayoffBracketView";
import { LanguageProvider } from "../../contexts/LanguageContext";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

const team = (id: string) => ({
  id,
  name: `Team ${id}`,
  roster: "orc",
  logoUrl: null,
  coachName: `Coach ${id}`,
});

function bracketRound(
  slot: string,
  roundNumber: number,
  overrides: Partial<CupBracketRound> = {},
): CupBracketRound {
  return {
    id: `r-${slot}`,
    roundNumber,
    slot,
    name: null,
    status: "pending",
    pairingId: `p-${slot}`,
    pairingStatus: "scheduled",
    placeholder: false,
    homeTeam: team("a"),
    awayTeam: team("b"),
    localMatch: null,
    scoreLabel: null,
    ...overrides,
  };
}

function response(over: Partial<CupBracketResponse> = {}): CupBracketResponse {
  return {
    cupId: "cup-1",
    playoffSize: 4,
    playoffsPublished: true,
    regularRoundsComplete: true,
    poolQualification: { totalQualified: 0, playoffSize: 4, consistent: true },
    rounds: [],
    ...over,
  };
}

function renderView(props: {
  isCommissioner?: boolean;
  eligibleTeams?: Array<{ id: string; name: string }>;
} = {}) {
  return render(
    <LanguageProvider>
      <CupPlayoffBracketView
        cupId="cup-1"
        isCommissioner={props.isCommissioner ?? false}
        eligibleTeams={
          props.eligibleTeams ?? [
            { id: "a", name: "Team a" },
            { id: "b", name: "Team b" },
            { id: "c", name: "Team c" },
            { id: "d", name: "Team d" },
          ]
        }
      />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  apiRequest.mockResolvedValue(response());
});

describe("CupPlayoffBracketView", () => {
  it("n'affiche RIEN au coach tant qu'aucun bracket n'existe", async () => {
    renderView();
    await waitFor(() =>
      expect(screen.queryByTestId("cup-playoffs-loading")).toBeNull(),
    );
    expect(screen.queryByTestId("cup-playoffs-launch")).toBeNull();
    expect(screen.queryByTestId("cup-playoffs")).toBeNull();
  });

  it("propose le lancement au commissaire, avec l'état de la phase de classement", async () => {
    apiRequest.mockResolvedValue(response({ regularRoundsComplete: false }));
    renderView({ isCommissioner: true });
    await screen.findByTestId("cup-playoffs-launch");
    // Phase encore ouverte ⇒ la clôture forcée est proposée.
    expect(screen.getByTestId("cup-playoffs-force")).toBeTruthy();
  });

  it("n'offre PAS la clôture forcée quand la phase est terminée", async () => {
    renderView({ isCommissioner: true });
    await screen.findByTestId("cup-playoffs-launch");
    expect(screen.queryByTestId("cup-playoffs-force")).toBeNull();
  });

  it("refuse de lancer un bracket de taille 0", async () => {
    apiRequest.mockResolvedValue(response({ playoffSize: 0 }));
    renderView({ isCommissioner: true });
    await screen.findByTestId("cup-playoffs-launch");
    expect(
      (screen.getByTestId("cup-playoffs-start") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("lance les play-offs, `force` reflétant la case cochée", async () => {
    apiRequest.mockResolvedValue(response({ regularRoundsComplete: false }));
    renderView({ isCommissioner: true });
    await screen.findByTestId("cup-playoffs-launch");
    fireEvent.click(screen.getByTestId("cup-playoffs-force"));
    fireEvent.click(screen.getByTestId("cup-playoffs-start"));
    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(
          ([path]) => path === "/cup/cup-1/playoffs/start",
        ),
      ).toBe(true),
    );
    const call = apiRequest.mock.calls.find(
      ([path]) => path === "/cup/cup-1/playoffs/start",
    );
    expect(JSON.parse((call![1] as { body: string }).body)).toEqual({
      force: true,
    });
  });

  it("annonce l'incohérence des quotas de poule avant le lancement", async () => {
    apiRequest.mockResolvedValue(
      response({
        poolQualification: {
          totalQualified: 6,
          playoffSize: 4,
          consistent: false,
        },
      }),
    );
    renderView({ isCommissioner: true });
    const state = await screen.findByTestId("cup-playoffs-pool-state");
    expect(state.textContent).toContain("6");
    expect(state.textContent).toContain("incohérent");
  });

  it("rend les tours en colonnes, des demies vers la finale", async () => {
    apiRequest.mockResolvedValue(
      response({
        rounds: [
          bracketRound("final", 8, {
            placeholder: true,
            awayTeam: team("a"),
          }),
          bracketRound("sf1", 6),
          bracketRound("sf2", 7),
        ],
      }),
    );
    renderView();
    await screen.findByTestId("cup-playoffs");
    expect(screen.getByTestId("cup-playoff-stage-sf")).toBeTruthy();
    expect(screen.getByTestId("cup-playoff-stage-final")).toBeTruthy();
    expect(screen.queryByTestId("cup-playoff-stage-qf")).toBeNull();
  });

  it("affiche « à déterminer » sur le côté encore vide d'un placeholder", async () => {
    apiRequest.mockResolvedValue(
      response({
        playoffSize: 2,
        rounds: [
          bracketRound("final", 8, { placeholder: true, awayTeam: team("a") }),
        ],
      }),
    );
    renderView();
    await screen.findByTestId("cup-playoffs");
    const sides = screen.getAllByTestId("cup-bracket-side-away");
    expect(sides[0].textContent).toContain("À déterminer");
  });

  it("affiche le score d'une rencontre jouée et le lien vers son match", async () => {
    apiRequest.mockResolvedValue(
      response({
        playoffSize: 2,
        rounds: [
          bracketRound("final", 8, {
            scoreLabel: "2 - 1",
            pairingStatus: "played",
            localMatch: { id: "lm1", status: "completed" },
          }),
        ],
      }),
    );
    renderView();
    await screen.findByTestId("cup-playoffs");
    expect(screen.getByTestId("cup-playoff-score-final").textContent).toBe(
      "2 - 1",
    );
    expect(
      screen.getByTestId("cup-playoff-match-final").getAttribute("href"),
    ).toBe("/local-matches/lm1");
  });

  it("le commissaire publie un bracket qui ne l'est pas encore", async () => {
    apiRequest.mockResolvedValue(
      response({
        playoffsPublished: false,
        rounds: [bracketRound("sf1", 6), bracketRound("sf2", 7)],
      }),
    );
    renderView({ isCommissioner: true });
    await screen.findByTestId("cup-playoffs");
    expect(
      screen.getByTestId("cup-playoffs-publish-state").textContent,
    ).toContain("non publié");
    fireEvent.click(screen.getByTestId("cup-playoffs-publish-toggle"));
    await waitFor(() => {
      const call = apiRequest.mock.calls.find(
        ([path]) => path === "/cup/cup-1/playoffs/publish",
      );
      expect(JSON.parse((call![1] as { body: string }).body)).toEqual({
        published: true,
      });
    });
  });

  it("ne montre ni publication ni édition à un coach", async () => {
    apiRequest.mockResolvedValue(
      response({ rounds: [bracketRound("sf1", 6), bracketRound("sf2", 7)] }),
    );
    renderView();
    await screen.findByTestId("cup-playoffs");
    expect(screen.queryByTestId("cup-playoffs-publish")).toBeNull();
    expect(screen.queryByTestId("cup-playoffs-edit-seeds")).toBeNull();
  });

  it("propose l'édition des têtes tant qu'aucun match n'est créé", async () => {
    apiRequest.mockResolvedValue(
      response({ rounds: [bracketRound("sf1", 6), bracketRound("sf2", 7)] }),
    );
    renderView({ isCommissioner: true });
    await screen.findByTestId("cup-playoffs");
    expect(screen.getByTestId("cup-playoffs-edit-seeds")).toBeTruthy();
  });

  it("retire l'édition dès qu'une rencontre du bracket a son match", async () => {
    apiRequest.mockResolvedValue(
      response({
        rounds: [
          bracketRound("sf1", 6, { localMatch: { id: "lm1", status: "in_progress" } }),
          bracketRound("sf2", 7),
        ],
      }),
    );
    renderView({ isCommissioner: true });
    await screen.findByTestId("cup-playoffs");
    expect(screen.queryByTestId("cup-playoffs-edit-seeds")).toBeNull();
  });

  it("refuse d'enregistrer des têtes incomplètes, sans appeler l'API", async () => {
    apiRequest.mockResolvedValue(
      response({
        rounds: [
          bracketRound("sf1", 6, { homeTeam: team("a"), awayTeam: team("b") }),
          bracketRound("sf2", 7, { homeTeam: team("c"), awayTeam: null }),
        ],
      }),
    );
    renderView({ isCommissioner: true });
    await screen.findByTestId("cup-playoffs");
    fireEvent.click(screen.getByTestId("cup-playoffs-edit-seeds"));
    fireEvent.click(screen.getByTestId("cup-playoffs-save-seeds"));
    expect(screen.getByTestId("cup-playoffs-seeds-error")).toBeTruthy();
    expect(
      apiRequest.mock.calls.some(([path]) =>
        String(path).includes("/playoffs/seeds"),
      ),
    ).toBe(false);
  });

  it("refuse un doublon dans les têtes", async () => {
    apiRequest.mockResolvedValue(
      response({ rounds: [bracketRound("sf1", 6), bracketRound("sf2", 7)] }),
    );
    renderView({ isCommissioner: true });
    await screen.findByTestId("cup-playoffs");
    fireEvent.click(screen.getByTestId("cup-playoffs-edit-seeds"));
    for (const idx of [0, 1, 2, 3]) {
      fireEvent.change(screen.getByTestId(`cup-playoff-seed-${idx}`), {
        target: { value: "a" },
      });
    }
    fireEvent.click(screen.getByTestId("cup-playoffs-save-seeds"));
    expect(
      screen.getByTestId("cup-playoffs-seeds-error").textContent,
    ).toContain("plusieurs fois");
  });

  it("enregistre les têtes dans l'ordre saisi", async () => {
    apiRequest.mockResolvedValue(
      response({ rounds: [bracketRound("sf1", 6), bracketRound("sf2", 7)] }),
    );
    renderView({ isCommissioner: true });
    await screen.findByTestId("cup-playoffs");
    fireEvent.click(screen.getByTestId("cup-playoffs-edit-seeds"));
    const values = ["a", "b", "c", "d"];
    values.forEach((v, idx) =>
      fireEvent.change(screen.getByTestId(`cup-playoff-seed-${idx}`), {
        target: { value: v },
      }),
    );
    fireEvent.click(screen.getByTestId("cup-playoffs-save-seeds"));
    await waitFor(() => {
      const call = apiRequest.mock.calls.find(
        ([path]) => path === "/cup/cup-1/playoffs/seeds",
      );
      expect(JSON.parse((call![1] as { body: string }).body)).toEqual({
        teamIds: values,
      });
    });
  });

  it("remonte l'erreur serveur au lieu d'un écran vide", async () => {
    apiRequest.mockRejectedValue(new Error("Coupe introuvable"));
    renderView({ isCommissioner: true });
    expect((await screen.findByTestId("cup-playoffs-error")).textContent).toBe(
      "Coupe introuvable",
    );
  });
});
