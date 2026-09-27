/**
 * Gate `competition_pdf_exports` : tant que le flag n'est pas actif pour le
 * compte (ou hors FeatureFlagProvider), aucun point d'entrée des exports PDF
 * n'est rendu.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

const { flags } = vi.hoisted(() => ({ flags: { keys: [] as string[] } }));
vi.mock("../featureFlags", () => ({
  fetchMyFlags: vi.fn(async () => flags.keys),
}));

import { FeatureFlagProvider } from "../../contexts/FeatureFlagContext";
import { useFeatureFlagOrOff } from "../../hooks/useFeatureFlag";
import { COMPETITION_PDF_EXPORTS_FLAG } from "../featureFlagKeys";
import LeaguePdfExports from "../../leagues/[id]/LeaguePdfExports";
import CupPdfExports from "../../cups/[id]/CupPdfExports";
import { MatchSheetPdfButton } from "../../leagues/pairings/[id]/sheet/_components/MatchSheetPdfButton";
import type { LeagueDetail, LeagueSeasonDetail } from "../../leagues/[id]/types";

const league = {
  id: "l1", name: "Ligue", winPoints: 3, drawPoints: 1, lossPoints: 0, forfeitPoints: -1,
} as unknown as LeagueDetail;
const season = {
  id: "s1", name: "Saison 1", rounds: [], participants: [],
} as unknown as LeagueSeasonDetail;
const sheet = { sheet: { status: "draft" }, teams: { home: null, away: null } };

function Wrapper({ children }: { children: ReactNode }) {
  return <FeatureFlagProvider>{children}</FeatureFlagProvider>;
}

function renderAll(withProvider: boolean) {
  const tree = (
    <>
      <LeaguePdfExports league={league} season={season} standings={[]} poolStandings={[]} pools={[]} tieBreakRules={[]} />
      <CupPdfExports cup={{ id: "c1", name: "Coupe" }} />
      <MatchSheetPdfButton data={sheet} />
    </>
  );
  return render(withProvider ? <Wrapper>{tree}</Wrapper> : tree);
}

describe("gate competition_pdf_exports", () => {
  beforeEach(() => {
    flags.keys = [];
  });

  it("hors provider : fermé", () => {
    renderAll(false);
    expect(screen.queryByTestId("league-pdf-menu")).toBeNull();
    expect(screen.queryByTestId("cup-pdf-menu")).toBeNull();
    expect(screen.queryByTestId("match-sheet-pdf")).toBeNull();
    const { result } = renderHook(() => useFeatureFlagOrOff(COMPETITION_PDF_EXPORTS_FLAG));
    expect(result.current).toBe(false);
  });

  it("flag OFF pour le compte : aucun export", async () => {
    flags.keys = ["offline_match"];
    renderAll(true);
    await Promise.resolve();
    expect(screen.queryByTestId("league-pdf-menu")).toBeNull();
    expect(screen.queryByTestId("cup-pdf-menu")).toBeNull();
    expect(screen.queryByTestId("match-sheet-pdf")).toBeNull();
  });

  it("flag ON : menus ligue et coupe, bouton de feuille", async () => {
    flags.keys = [COMPETITION_PDF_EXPORTS_FLAG];
    renderAll(true);
    expect(await screen.findByTestId("league-pdf-menu")).toBeTruthy();
    expect(screen.getByTestId("cup-pdf-menu")).toBeTruthy();
    expect(screen.getByTestId("match-sheet-pdf")).toBeTruthy();
  });
});
