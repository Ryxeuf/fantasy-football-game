/**
 * Haine (X) — choix du Mot-clé haï avant la validation.
 *
 * Un adversaire porte souvent plusieurs lignées : le panneau doit les offrir
 * TOUTES au coach du blessé, et ne rien laisser modifier à celui d'en face.
 */

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  HateKeywordChoices,
  type HateCandidateView,
} from "./HateKeywordChoices";

/** Les trois lignées d'un Zombie. */
const ZOMBIE_KEYWORDS = ["Humain", "Mort-Vivant", "Zombie"];

function candidate(over: Partial<HateCandidateView> = {}): HateCandidateView {
  return {
    victimPlayerId: "a1",
    side: "away",
    causerPlayerId: "h1",
    keywords: ZOMBIE_KEYWORDS,
    keyword: "Humain",
    chosen: false,
    ...over,
  };
}

const LABELS: Readonly<Record<string, string>> = {
  a1: "N°1 Humain 1",
  h1: "N°1 Zombie 1",
};

function renderPanel(
  candidates: readonly HateCandidateView[],
  opts: {
    canEdit?: (side: "home" | "away") => boolean;
    onChoose?: (victimPlayerId: string, keyword: string) => void;
  } = {},
) {
  const onChoose = opts.onChoose ?? vi.fn();
  render(
    <HateKeywordChoices
      candidates={candidates}
      playerLabel={(id) => LABELS[id] ?? id}
      teamLabel={(side) => (side === "home" ? "Champs Funestes" : "Reikland")}
      canEdit={opts.canEdit ?? (() => true)}
      onChoose={onChoose}
    />,
  );
  return onChoose;
}

describe("HateKeywordChoices", () => {
  it("n'affiche rien quand personne n'est candidat au jet", () => {
    const { container } = render(
      <HateKeywordChoices
        candidates={[]}
        playerLabel={(id) => id}
        teamLabel={() => ""}
        canEdit={() => true}
        onChoose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("propose toutes les lignées de l'adversaire qui a blessé", () => {
    renderPanel([candidate()]);
    const select = screen.getByTestId(
      "hate-choice-select-a1",
    ) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "Haine (Humain)",
      "Haine (Mort-Vivant)",
      "Haine (Zombie)",
    ]);
    // Le blessé et son bourreau sont nommés : sans ça, le coach ne sait pas
    // pour qui il choisit.
    const row = screen.getByTestId("hate-choice-a1");
    expect(row.textContent).toContain("N°1 Humain 1");
    expect(row.textContent).toContain("N°1 Zombie 1");
    expect(row.textContent).toContain("Reikland");
  });

  it("pré-sélectionne le mot-clé retenu et remonte le changement", () => {
    const onChoose = renderPanel([
      candidate({ keyword: "Mort-Vivant", chosen: true }),
    ]);
    const select = screen.getByTestId(
      "hate-choice-select-a1",
    ) as HTMLSelectElement;
    expect(select.value).toBe("Mort-Vivant");
    fireEvent.change(select, { target: { value: "Zombie" } });
    expect(onChoose).toHaveBeenCalledWith("a1", "Zombie");
  });

  // Le repli doit se voir : sinon un coach croit que son choix tient alors
  // que l'auteur de la sortie a changé depuis.
  it("signale un mot-clé servi par défaut", () => {
    renderPanel([candidate({ chosen: false })]);
    expect(screen.getByTestId("hate-choice-a1").textContent).toContain(
      "par défaut",
    );
    renderPanel([candidate({ chosen: true })]);
    expect(screen.getAllByTestId("hate-choice-a1")[1].textContent).not.toContain(
      "par défaut",
    );
  });

  // Le trait est un acquis du blessé : le coach adverse le lit, sans le
  // choisir. Le serveur refuse de toute façon (403).
  it("n'offre aucun sélecteur au coach de l'autre côté", () => {
    renderPanel([candidate()], { canEdit: (side) => side === "home" });
    expect(screen.queryByTestId("hate-choice-select-a1")).toBeNull();
    expect(screen.getByTestId("hate-choice-fixed-a1").textContent).toBe(
      "Haine (Humain)",
    );
  });

  // Une seule lignée : rien à choisir, on l'affiche telle quelle.
  it("affiche un mot-clé unique sans sélecteur", () => {
    renderPanel([candidate({ keywords: ["Humain"], keyword: "Humain" })]);
    expect(screen.queryByTestId("hate-choice-select-a1")).toBeNull();
    expect(screen.getByTestId("hate-choice-fixed-a1")).toBeTruthy();
  });
});
