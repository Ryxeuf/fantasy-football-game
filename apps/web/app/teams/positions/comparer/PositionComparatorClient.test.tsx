import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PositionComparatorClient from "./PositionComparatorClient";
import type { ListedPosition } from "../../position-rankings";

function pos(over: Partial<ListedPosition>): ListedPosition {
  return {
    slug: "skaven_lineman",
    displayName: "Lineman",
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
    ...over,
  };
}

const POSITIONS: ListedPosition[] = [
  pos({
    slug: "skaven_coureur_d_egouts",
    displayName: "Coureur d'Égouts",
    ma: 9,
    ag: 2,
  }),
  pos({
    slug: "human_blitzer",
    displayName: "Blitzer",
    rosterSlug: "human",
    rosterName: "Humains",
    ma: 7,
    st: 3,
  }),
  pos({
    slug: "human_lineman",
    displayName: "Trois-Quart",
    rosterSlug: "human",
    rosterName: "Humains",
    ma: 6,
  }),
];

describe("PositionComparatorClient", () => {
  it("affiche un indice tant que moins de 2 positions sont choisies", () => {
    render(
      <PositionComparatorClient
        initialPositions={POSITIONS}
        initialSelected={[]}
      />,
    );
    expect(screen.getByTestId("comparator-hint")).toBeTruthy();
    expect(screen.queryByTestId("position-comparison")).toBeNull();
  });

  it("pré-sélectionne via initialSelected et affiche la comparaison", () => {
    render(
      <PositionComparatorClient
        initialPositions={POSITIONS}
        initialSelected={["skaven_coureur_d_egouts", "human_blitzer"]}
      />,
    );
    expect(screen.getByTestId("position-comparison")).toBeTruthy();
    expect(screen.getAllByText(/Coureur d'Égouts/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blitzer").length).toBeGreaterThan(0);
  });

  it("permet de sélectionner des positions via le picker", () => {
    render(
      <PositionComparatorClient
        initialPositions={POSITIONS}
        initialSelected={[]}
      />,
    );
    fireEvent.click(screen.getByTestId("picker-skaven_coureur_d_egouts"));
    fireEvent.click(screen.getByTestId("picker-human_blitzer"));
    expect(screen.getByTestId("position-comparison")).toBeTruthy();
  });

  it("ignore les slugs inconnus passés en initialSelected", () => {
    render(
      <PositionComparatorClient
        initialPositions={POSITIONS}
        initialSelected={["slug_inexistant", "human_blitzer"]}
      />,
    );
    // une seule position valide -> sous le minimum -> indice affiché
    expect(screen.getByTestId("comparator-hint")).toBeTruthy();
  });
});
