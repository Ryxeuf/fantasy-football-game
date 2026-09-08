/**
 * Rondes suisses d'une coupe : rendu des rencontres (score orienté,
 * exempt, « mon match »), actions selon le rôle (générer / supprimer pour
 * le commissaire, créer le match pour un coach impliqué) et blocage tant
 * que la ronde courante est ouverte.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CupRoundsView, {
  cupPairingScoreLabel,
  isRoundOpen,
  type CupRoundView,
} from "./CupRoundsView";
import { LanguageProvider } from "../../contexts/LanguageContext";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const team = (id: string, ownerId: string) => ({
  id,
  name: `Team ${id}`,
  roster: "orc",
  logoUrl: null,
  ownerId,
  coachName: `Coach ${id}`,
});

function round(pairings: CupRoundView["pairings"], overrides: Partial<CupRoundView> = {}): CupRoundView {
  return {
    id: "r1",
    roundNumber: 1,
    name: null,
    system: "swiss",
    status: "pending",
    scheduledAt: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    pairings,
    ...overrides,
  };
}

const PLAYED = {
  id: "p1",
  tableNumber: 1,
  status: "played",
  scheduledAt: null,
  homeTeam: team("a", "o-a"),
  awayTeam: team("b", "o-b"),
  // Le match local a été créé par le coach VISITEUR : côté A = b.
  localMatch: { id: "lm1", status: "completed", teamAId: "b", scoreTeamA: 0, scoreTeamB: 3 },
};
const OPEN = {
  id: "p2",
  tableNumber: 2,
  status: "scheduled",
  scheduledAt: null,
  homeTeam: team("c", "o-c"),
  awayTeam: team("d", "o-d"),
  localMatch: null,
};
const BYE = {
  id: "p3",
  tableNumber: 3,
  status: "bye",
  scheduledAt: null,
  homeTeam: team("e", "o-e"),
  awayTeam: null,
  localMatch: null,
};

function renderView(props: {
  rounds: CupRoundView[];
  isCommissioner?: boolean;
  myTeamIds?: string[];
  cupStatus?: string;
  participantCount?: number;
}) {
  const onChanged = vi.fn();
  render(
    <LanguageProvider>
      <CupRoundsView
        cupId="cup-1"
        cupStatus={props.cupStatus ?? "en_cours"}
        rounds={props.rounds}
        isCommissioner={props.isCommissioner ?? false}
        myTeamIds={props.myTeamIds ?? []}
        participantCount={props.participantCount ?? 5}
        onChanged={onChanged}
      />
    </LanguageProvider>,
  );
  return onChanged;
}

describe("helpers purs", () => {
  it("oriente le score selon le côté A du match local", () => {
    expect(cupPairingScoreLabel(PLAYED)).toBe("3 – 0");
    expect(cupPairingScoreLabel(OPEN)).toBeNull();
  });
  it("une ronde reste ouverte tant qu'une rencontre est à jouer", () => {
    expect(isRoundOpen(round([PLAYED, OPEN, BYE]))).toBe(true);
    expect(isRoundOpen(round([PLAYED, BYE]))).toBe(false);
  });
});

describe("CupRoundsView", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({});
    push.mockReset();
  });

  it("affiche score, exempt, table et statut de chaque rencontre", () => {
    renderView({ rounds: [round([PLAYED, OPEN, BYE])] });
    expect(screen.getByTestId("cup-pairing-score-p1").textContent).toBe("3 – 0");
    expect(screen.getByTestId("cup-pairing-p3-bye").textContent).toBe("Exempt");
    expect(screen.getByTestId("cup-pairing-status-p2").textContent).toBe("À jouer");
    expect(screen.getByTestId("cup-round-progress-r1").textContent).toBe("1/2 jouées");
    // Coach non impliqué : aucune action de match.
    expect(screen.queryByTestId("cup-pairing-create-p2")).toBeNull();
    expect(screen.queryByTestId("cup-swiss-generate")).toBeNull();
  });

  it("le coach impliqué crée le match local de SA rencontre puis y est envoyé", async () => {
    apiRequest.mockResolvedValue({ localMatch: { id: "lm-new" } });
    renderView({ rounds: [round([OPEN])], myTeamIds: ["d"] });
    expect(screen.getByTestId("cup-pairing-p2-mine").textContent).toBe("Mon match");
    fireEvent.click(screen.getByTestId("cup-pairing-create-p2"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/local-matches/lm-new"));
    const [path, init] = apiRequest.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/local-match");
    expect(JSON.parse(String(init.body))).toEqual({
      teamAId: "d",
      teamBId: "c",
      cupId: "cup-1",
      cupPairingId: "p2",
    });
  });

  it("le commissaire génère la ronde suivante seulement quand la ronde courante est terminée", async () => {
    const onChanged = renderView({ rounds: [round([PLAYED, OPEN, BYE])], isCommissioner: true });
    const generate = screen.getByTestId("cup-swiss-generate") as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    expect(screen.getByTestId("cup-swiss-blocked")).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("génère la ronde 2 et recharge la coupe", async () => {
    const onChanged = renderView({
      rounds: [round([PLAYED, BYE], { status: "completed" })],
      isCommissioner: true,
    });
    const generate = screen.getByTestId("cup-swiss-generate") as HTMLButtonElement;
    expect(generate.disabled).toBe(false);
    expect(generate.textContent).toContain("ronde 2");
    fireEvent.click(generate);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(apiRequest.mock.calls[0][0]).toBe("/cup/cup-1/rounds/swiss");
  });

  it("propose la suppression de la dernière ronde seulement sans match créé", () => {
    renderView({ rounds: [round([OPEN, BYE])], isCommissioner: true });
    expect(screen.getByTestId("cup-swiss-delete-last")).toBeTruthy();
    expect(screen.getByTestId("cup-pairing-cancel-p2")).toBeTruthy();
  });

  it("invite le commissaire à valider la coupe avant la première ronde", () => {
    renderView({ rounds: [], isCommissioner: true, cupStatus: "ouverte" });
    expect(screen.getByTestId("cup-rounds-empty").textContent).toContain("Validez la coupe");
    expect((screen.getByTestId("cup-swiss-generate") as HTMLButtonElement).disabled).toBe(true);
  });
});
