/**
 * Haine (X) — récapitulatif des jets d'après-match.
 *
 * Le D6 est lancé côté serveur : ce panneau est le SEUL endroit où le coach
 * apprend qu'un jet a eu lieu. Les tests vérifient donc qu'il dit la vérité
 * du dé ET celle de l'attribution, y compris quand les deux divergent.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HateRollsRecap, type HateRollView } from "./HateRollsRecap";

const apiRequest = vi.fn();
vi.mock("../../../../../lib/api-client", () => ({
  apiRequest: (path: string, init?: RequestInit) => apiRequest(path, init),
  ApiClientError: class extends Error {},
}));

function roll(over: Partial<HateRollView> = {}): HateRollView {
  return {
    playerId: "p1",
    playerName: "Grognak",
    teamId: "t1",
    keyword: "Orque",
    skillSlug: "hate-orque",
    roll: 5,
    granted: true,
    ...over,
  };
}

describe("HateRollsRecap", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiRequest.mockResolvedValue({ skills: [] });
  });

  it("n'affiche rien quand aucun dé n'a été lancé", () => {
    const { container } = render(<HateRollsRecap rolls={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("affiche le résultat du dé et le trait gagné", async () => {
    render(<HateRollsRecap rolls={[roll({ roll: 6 })]} />);

    expect(await screen.findByTestId("hate-rolls-recap")).toBeTruthy();
    expect(screen.getByTestId("hate-roll-granted")).toBeTruthy();
    expect(screen.getByLabelText("Résultat du dé : 6")).toBeTruthy();
    expect(screen.getByText(/Grognak/)).toBeTruthy();
    expect(screen.getByText(/Haine \(Orque\)/)).toBeTruthy();
  });

  it("affiche AUSSI un jet raté : le dé a été lancé", async () => {
    render(<HateRollsRecap rolls={[roll({ roll: 2, granted: false })]} />);

    expect(await screen.findByTestId("hate-roll-failed")).toBeTruthy();
    expect(screen.getByLabelText("Résultat du dé : 2")).toBeTruthy();
    expect(screen.getByText(/aucun trait accordé \(4\+ requis\)/)).toBeTruthy();
    expect(screen.getByText(/Aucun trait accordé sur ce match\./)).toBeTruthy();
  });

  it("distingue un 4+ qui n'a RIEN accordé d'un jet raté", async () => {
    render(
      <HateRollsRecap
        rolls={[
          roll({ roll: 5, granted: false, failure: "skill-unavailable" }),
        ]}
      />,
    );

    // Le dé dit 5 : dire « 4+ requis » serait un mensonge.
    expect(await screen.findByLabelText("Résultat du dé : 5")).toBeTruthy();
    expect(screen.queryByText(/4\+ requis/)).toBeNull();
    expect(screen.getByText(/n'a pas pu être créé au catalogue/)).toBeTruthy();
  });

  it("rend un `failure` inconnu sans casser l'affichage", async () => {
    render(
      <HateRollsRecap
        rolls={[roll({ granted: false, failure: "quelque-chose-de-neuf" })]}
      />,
    );
    expect(await screen.findByText(/aucun trait accordé/)).toBeTruthy();
  });

  it("situe le joueur dans son équipe", async () => {
    render(
      <HateRollsRecap
        rolls={[roll()]}
        teamNames={{ t1: "Les Orcs de Bordeaux" }}
      />,
    );
    expect(await screen.findByText(/Les Orcs de Bordeaux/)).toBeTruthy();
  });

  it("préfère le libellé officiel du catalogue au repli", async () => {
    apiRequest.mockResolvedValue({
      skills: [{ slug: "hate-orque", nameFr: "Haine (Orque, S3)" }],
    });
    render(<HateRollsRecap rolls={[roll()]} ruleset="season_3" />);

    await waitFor(() =>
      expect(screen.getByText(/Haine \(Orque, S3\)/)).toBeTruthy(),
    );
  });

  it("retombe sur le mot-clé quand le catalogue ne connaît pas encore le trait", async () => {
    // Trait fraîchement créé : le catalogue chargé peut être antérieur. On ne
    // doit JAMAIS afficher le slug brut.
    render(
      <HateRollsRecap
        rolls={[
          roll({ skillSlug: "hate-homme-lezard", keyword: "Homme-lézard" }),
        ]}
      />,
    );
    expect(await screen.findByText(/Haine \(Homme-lézard\)/)).toBeTruthy();
    expect(screen.queryByText(/hate-homme-lezard/)).toBeNull();
  });

  it("accorde le pluriel du récapitulatif", async () => {
    render(
      <HateRollsRecap
        rolls={[roll(), roll({ playerId: "p2", playerName: "Zug" })]}
      />,
    );
    expect(await screen.findByText(/2 traits accordés/)).toBeTruthy();
  });

  it("rend le joueur même sans nom figé (ancien snapshot)", async () => {
    render(<HateRollsRecap rolls={[roll({ playerName: "" })]} />);
    expect(await screen.findByText(/p1/)).toBeTruthy();
  });
});
