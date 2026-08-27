import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "fr" }),
}));

import PositionKeywordBrowser from "./PositionKeywordBrowser";
import type { ListedPosition } from "../position-rankings";

function pos(i: number): ListedPosition {
  return {
    slug: `skaven_poste_${i}`,
    displayName: `Poste ${i}`,
    rosterSlug: "skaven",
    rosterName: "Skavens",
    cost: 50,
    min: 0,
    max: 16,
    ma: 7,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: "",
    keywords: "Skaven, Trois-quart",
  };
}

const MANY: ListedPosition[] = Array.from({ length: 40 }, (_, i) => pos(i));

describe("PositionKeywordBrowser", () => {
  it("est replié par défaut : la liste ne pousse pas la page hors écran", () => {
    render(<PositionKeywordBrowser positions={MANY} />);
    expect(screen.queryByTestId("keyword-results")).toBeNull();
    // Le compteur reste visible pour signaler ce que contient le panneau.
    expect(screen.getByTestId("keyword-count").textContent).toContain("40");
  });

  it("déplie la liste au clic et la borne à 24 entrées", () => {
    render(<PositionKeywordBrowser positions={MANY} />);
    fireEvent.click(screen.getByTestId("keyword-toggle"));
    expect(screen.getByTestId("keyword-results").children).toHaveLength(24);
    expect(screen.getByTestId("keyword-show-all").textContent).toContain("16");
  });

  it("affiche tout puis réduit à la demande", () => {
    render(<PositionKeywordBrowser positions={MANY} />);
    fireEvent.click(screen.getByTestId("keyword-toggle"));
    fireEvent.click(screen.getByTestId("keyword-show-all"));
    expect(screen.getByTestId("keyword-results").children).toHaveLength(40);
    fireEvent.click(screen.getByTestId("keyword-show-all"));
    expect(screen.getByTestId("keyword-results").children).toHaveLength(24);
  });

  it("ne propose pas « voir plus » sous le seuil", () => {
    render(<PositionKeywordBrowser positions={MANY.slice(0, 5)} />);
    fireEvent.click(screen.getByTestId("keyword-toggle"));
    expect(screen.getByTestId("keyword-results").children).toHaveLength(5);
    expect(screen.queryByTestId("keyword-show-all")).toBeNull();
  });
});
