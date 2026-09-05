/**
 * Tests de la page de creation de ligue, cote DOCUMENTS OFFICIELS.
 *
 * Le point delicat : la ligue n'a pas d'id tant qu'elle n'est pas creee, donc
 * les documents sont deposes APRES le `POST /leagues`. Si ce depot echoue, la
 * ligue existe deja — re-soumettre le formulaire ne doit surtout pas en creer
 * une seconde.
 *
 * `LeagueForm` est stubbe : on ne teste pas son rendu (couvert par
 * `LeagueForm.test.tsx`), seulement l'orchestration de la page.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";

const push = vi.fn();

/**
 * Valeurs completes du formulaire : la page lit `allowedRosters`,
 * `allowedInducements` et `bonusPointsConfig` — un objet partiel ferait
 * echouer la soumission sur un TypeError, pas sur la logique testee.
 */
const FORM_VALUES = {
  name: "Ligue des Documents",
  description: "",
  ruleset: "season_3" as const,
  tournamentRuleset: null,
  isPublic: true,
  maxParticipants: 8,
  allowedRosters: [] as string[],
  allowedInducements: [] as string[],
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
  bonusPointsConfig: [],
};

vi.mock("../../hooks/useFeatureFlag", () => ({
  useFeatureFlag: vi.fn(() => true),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class extends Error {},
}));
vi.mock("../../lib/competition-documents", () => ({
  uploadPendingCompetitionDocuments: vi.fn(),
}));

// Stub minimal du formulaire : un bouton pour soumettre, un pour attacher un
// document. Le vrai rendu est teste dans `LeagueForm.test.tsx`.
vi.mock("../_components/LeagueForm", () => ({
  LEAGUE_FORM_DEFAULTS: {},
  LeagueForm: ({
    onSubmit,
    onPendingDocumentsChange,
    pendingDocuments,
  }: {
    onSubmit: (v: unknown) => void;
    onPendingDocumentsChange?: (files: File[]) => void;
    pendingDocuments?: readonly File[];
  }) => (
    <div>
      <button
        type="button"
        data-testid="stub-attach"
        onClick={() =>
          onPendingDocumentsChange?.([
            new File(["%PDF-1.7"], "reglement.pdf", {
              type: "application/pdf",
            }),
          ])
        }
      >
        joindre
      </button>
      <span data-testid="stub-pending-count">
        {pendingDocuments?.length ?? 0}
      </span>
      <button
        type="button"
        data-testid="stub-submit"
        onClick={() => onSubmit(FORM_VALUES)}
      >
        creer
      </button>
    </div>
  ),
}));

import NewLeaguePage from "./page";
import { apiRequest } from "../../lib/api-client";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { uploadPendingCompetitionDocuments } from "../../lib/competition-documents";

const mockedRequest = vi.mocked(apiRequest);
const mockedUpload = vi.mocked(uploadPendingCompetitionDocuments);
const mockedFlag = vi.mocked(useFeatureFlag);

function renderPage() {
  return render(
    <LanguageProvider>
      <NewLeaguePage />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  // `resetAllMocks` (et non `clearAllMocks`) : un test utilise la queue
  // `mockResolvedValueOnce`, qui doit repartir vide. Contrepartie : les
  // implementations posees dans les factories `vi.mock` sont effacees, il
  // faut les reposer ici.
  vi.resetAllMocks();
  mockedFlag.mockReturnValue(true);
  push.mockReset();
  mockedRequest.mockResolvedValue({ id: "league-1" });
  mockedUpload.mockResolvedValue([]);
});

describe("NewLeaguePage — documents officiels", () => {
  it("ne televerse rien quand aucun document n'est joint", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("stub-submit"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/leagues/league-1"));
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("depose les documents joints juste apres la creation", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("stub-attach"));
    await waitFor(() =>
      expect(screen.getByTestId("stub-pending-count").textContent).toBe("1"),
    );
    fireEvent.click(screen.getByTestId("stub-submit"));

    await waitFor(() =>
      expect(mockedUpload).toHaveBeenCalledWith(
        "leagues",
        "league-1",
        expect.arrayContaining([expect.any(File)]),
      ),
    );
    expect(push).toHaveBeenCalledWith("/leagues/league-1");
  });

  it("signale l'echec de depot sans annuler la ligue creee", async () => {
    mockedUpload.mockResolvedValue(["reglement.pdf : trop volumineux"]);
    renderPage();
    fireEvent.click(screen.getByTestId("stub-attach"));
    fireEvent.click(screen.getByTestId("stub-submit"));

    const notice = await screen.findByTestId("new-league-created-notice");
    expect(notice.textContent).toContain("La ligue a bien été créée");
    expect(push).not.toHaveBeenCalled();
  });

  it("ne recree PAS la ligue quand on reessaie le depot", async () => {
    mockedUpload.mockResolvedValueOnce(["reglement.pdf : erreur"]);
    renderPage();
    fireEvent.click(screen.getByTestId("stub-attach"));
    fireEvent.click(screen.getByTestId("stub-submit"));
    await screen.findByTestId("new-league-created-notice");
    expect(mockedRequest).toHaveBeenCalledTimes(1);

    // Deuxieme soumission : seul l'upload est rejoue.
    mockedUpload.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByTestId("stub-submit"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/leagues/league-1"));
    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(mockedUpload).toHaveBeenCalledTimes(2);
  });
});
