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
  participants?: Array<{ id: string; name: string }>;
  poolNamesById?: Record<string, string>;
  poolIdByTeamId?: Record<string, string | null>;
  preferredPoolId?: string | null;
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
        participants={props.participants ?? []}
        poolNamesById={props.poolNamesById}
        poolIdByTeamId={props.poolIdByTeamId}
        preferredPoolId={props.preferredPoolId}
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
    expect(apiRequest.mock.calls[0][0]).toBe("/cup/cup-1/rounds");
    // Défaut hors première ronde : tirage au sort tant que le commissaire
    // n'a rien choisi d'autre — le système part TOUJOURS dans le corps.
    expect(
      JSON.parse((apiRequest.mock.calls[0][1] as { body: string }).body),
    ).toMatchObject({ system: "random" });
  });

  it("propose les trois systèmes d'appariement au commissaire", () => {
    renderView({
      rounds: [round([PLAYED, BYE], { status: "completed" })],
      isCommissioner: true,
    });
    for (const system of ["random", "swiss", "manual"]) {
      expect(screen.getByTestId(`cup-round-system-${system}`)).toBeTruthy();
    }
  });

  it("le bandeau suit le système d'appariement sélectionné", () => {
    renderView({
      rounds: [round([PLAYED, BYE], { status: "completed" })],
      isCommissioner: true,
      participants: [
        { id: "t1", name: "Alpha" },
        { id: "t2", name: "Bravo" },
      ],
    });
    // Défaut : tirage au sort — et surtout PAS le texte de la suisse.
    expect(screen.getByTestId("cup-rounds-title").textContent).toContain(
      "Tirage au sort",
    );
    const random = screen.getByTestId("cup-rounds-description").textContent;
    expect(random).toContain("tiré au sort");
    expect(random).not.toContain("selon le classement");

    fireEvent.click(screen.getByTestId("cup-round-system-swiss"));
    expect(screen.getByTestId("cup-rounds-title").textContent).toContain(
      "Ronde suisse",
    );
    expect(screen.getByTestId("cup-rounds-description").textContent).toContain(
      "selon le classement",
    );

    fireEvent.click(screen.getByTestId("cup-round-system-manual"));
    expect(screen.getByTestId("cup-rounds-title").textContent).toContain(
      "Saisie manuelle",
    );
    expect(screen.getByTestId("cup-rounds-description").textContent).toContain(
      "vous-même",
    );
  });

  it("reste neutre pour un coach : aucun système n'est annoncé", () => {
    renderView({ rounds: [round([OPEN])], myTeamIds: ["d"] });
    expect(screen.queryByTestId("cup-round-system")).toBeNull();
    expect(screen.getByTestId("cup-rounds-title").textContent).toBe("Rondes");
    const description = screen.getByTestId("cup-rounds-description").textContent;
    expect(description).not.toContain("suisse");
    expect(description).not.toContain("classement");
  });

  it("reste neutre pour le commissaire tant qu'une ronde est ouverte", () => {
    renderView({ rounds: [round([OPEN])], isCommissioner: true });
    expect(screen.queryByTestId("cup-round-system")).toBeNull();
    expect(screen.getByTestId("cup-rounds-title").textContent).toBe("Rondes");
  });

  it("bloque la génération manuelle tant qu'aucune rencontre n'est saisie", () => {
    renderView({
      rounds: [round([PLAYED, BYE], { status: "completed" })],
      isCommissioner: true,
      participants: [
        { id: "t1", name: "Alpha" },
        { id: "t2", name: "Bravo" },
      ],
    });
    fireEvent.click(screen.getByTestId("cup-round-system-manual"));
    expect(screen.getByTestId("cup-manual-empty")).toBeTruthy();
    expect(
      (screen.getByTestId("cup-swiss-generate") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("envoie les rencontres composées à la main", async () => {
    const onChanged = renderView({
      rounds: [round([PLAYED, BYE], { status: "completed" })],
      isCommissioner: true,
      participants: [
        { id: "t1", name: "Alpha" },
        { id: "t2", name: "Bravo" },
      ],
    });
    fireEvent.click(screen.getByTestId("cup-round-system-manual"));
    fireEvent.click(screen.getByTestId("cup-manual-add"));
    fireEvent.change(screen.getByTestId("cup-manual-home-0"), {
      target: { value: "t1" },
    });
    fireEvent.change(screen.getByTestId("cup-manual-away-0"), {
      target: { value: "t2" },
    });
    fireEvent.click(screen.getByTestId("cup-swiss-generate"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(
      JSON.parse((apiRequest.mock.calls[0][1] as { body: string }).body),
    ).toEqual({
      system: "manual",
      pairings: [{ homeTeamId: "t1", awayTeamId: "t2" }],
    });
  });

  it("ouvre la feuille de match d'une rencontre, comme en ligue", () => {
    renderView({ rounds: [round([OPEN, BYE])], isCommissioner: true });
    const link = screen.getByTestId("cup-pairing-sheet-p2");
    expect(link.getAttribute("href")).toBe("/cups/pairings/p2/sheet");
    // Un exempt n'a pas de feuille : il n'y a pas de match à saisir.
    expect(screen.queryByTestId("cup-pairing-sheet-p3")).toBeNull();
  });

  it("propose la suppression de la dernière ronde seulement sans match créé", () => {
    renderView({ rounds: [round([OPEN, BYE])], isCommissioner: true });
    expect(screen.getByTestId("cup-swiss-delete-last")).toBeTruthy();
    expect(screen.getByTestId("cup-pairing-cancel-p2")).toBeTruthy();
  });

  it("annonce une ronde de bracket comme un play-off, pas comme une suisse", () => {
    renderView({
      rounds: [
        round([PLAYED], {
          id: "r-final",
          system: "bracket",
          kind: "playoff",
          bracketSlot: "final",
        }),
      ],
    });
    expect(
      screen.getByTestId("cup-round-system-badge-r-final").textContent,
    ).toBe("Play-off");
  });

  it("groupe les rencontres d'une ronde par poule, la poule du coach en tête", () => {
    renderView({
      rounds: [round([OPEN, PLAYED], { id: "r1" })],
      poolNamesById: { pa: "Poule A", pb: "Poule B" },
      // OPEN reçoit avec `c`, PLAYED avec `a`.
      poolIdByTeamId: { a: "pa", c: "pb" },
      preferredPoolId: "pb",
    });
    const headings = screen
      .getAllByTestId(/^cup-round-pool-r1-/)
      .map((el) => el.getAttribute("data-testid"));
    expect(headings).toEqual(["cup-round-pool-r1-pb", "cup-round-pool-r1-pa"]);
    expect(screen.getByTestId("cup-round-my-pool-r1").textContent).toBe("Ma poule");
  });

  it("reste à plat sans poule — le comportement d'avant les poules", () => {
    renderView({ rounds: [round([OPEN, PLAYED], { id: "r1" })] });
    expect(screen.queryAllByTestId(/^cup-round-pool-r1-/)).toHaveLength(0);
    // Les rencontres restent rendues, elles : à plat n'est pas vide.
    // (`getAllBy` : le logo d'équipe répète le nom dans son <title>.)
    expect(screen.getAllByText("Team c").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Team a").length).toBeGreaterThan(0);
  });

  it("reste à plat quand toutes les rencontres tombent dans la même poule", () => {
    renderView({
      rounds: [round([OPEN, PLAYED], { id: "r1" })],
      poolNamesById: { pa: "Poule A", pb: "Poule B" },
      poolIdByTeamId: { a: "pa", c: "pa" },
    });
    expect(screen.queryAllByTestId(/^cup-round-pool-r1-/)).toHaveLength(0);
  });

  it("ne groupe pas une ronde de bracket : elle oppose deux poules", () => {
    renderView({
      rounds: [
        round([OPEN], {
          id: "r-final",
          kind: "playoff",
          system: "bracket",
          bracketSlot: "final",
        }),
      ],
      poolNamesById: { pa: "Poule A", pb: "Poule B" },
      poolIdByTeamId: { c: "pa", d: "pb" },
    });
    expect(screen.queryAllByTestId(/^cup-round-pool-r-final-/)).toHaveLength(0);
  });

  it("montre une équipe non affectée sous un groupe sans nom, en queue", () => {
    renderView({
      rounds: [round([OPEN, PLAYED], { id: "r1" })],
      poolNamesById: { pa: "Poule A" },
      poolIdByTeamId: { a: "pa" },
    });
    const headings = screen
      .getAllByTestId(/^cup-round-pool-r1-/)
      .map((el) => el.getAttribute("data-testid"));
    expect(headings).toEqual(["cup-round-pool-r1-pa", "cup-round-pool-r1-none"]);
    expect(
      screen.getByTestId("cup-round-pool-r1-none").textContent,
    ).toContain("Non affectée");
  });

  it("invite le commissaire à valider la coupe avant la première ronde", () => {
    renderView({ rounds: [], isCommissioner: true, cupStatus: "ouverte" });
    expect(screen.getByTestId("cup-rounds-empty").textContent).toContain("Validez la coupe");
    expect((screen.getByTestId("cup-swiss-generate") as HTMLButtonElement).disabled).toBe(true);
  });
});
