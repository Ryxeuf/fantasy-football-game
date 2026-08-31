/**
 * A157 — les étiquettes d'état du roster dans « Gérer mon équipe ».
 *
 * Sans elles, un coach prépare son équipe sans voir qui est réellement
 * disponible : le mort reste au roster, l'absent rate le prochain match et
 * les Blessures Persistantes pèsent sur les jets de blessure suivants.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerStatusTags from "./PlayerStatusTags";

describe("PlayerStatusTags", () => {
  it("ne rend rien pour un joueur sain (aucun bruit sur le cas courant)", () => {
    const { container } = render(
      <PlayerStatusTags player={{}} playerId="p1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("annonce l'absence au prochain match", () => {
    render(<PlayerStatusTags player={{ missNextMatch: true }} playerId="p1" />);
    expect(screen.getByTestId("player-status-absent-p1").textContent).toBe(
      "Absent",
    );
  });

  it("annonce les Blessures Persistantes avec leur nombre", () => {
    render(<PlayerStatusTags player={{ nigglingInjuries: 2 }} playerId="p1" />);
    expect(screen.getByTestId("player-status-niggling-p1").textContent).toBe(
      "2 BP",
    );
  });

  it("annonce la mort, et pas l'absence (un mort ne joue plus du tout)", () => {
    render(
      <PlayerStatusTags
        player={{ dead: true, missNextMatch: true }}
        playerId="p1"
      />,
    );
    expect(screen.getByTestId("player-status-dead-p1").textContent).toContain(
      "Mort",
    );
    expect(screen.queryByTestId("player-status-absent-p1")).toBeNull();
  });

  it("cumule les états d'un même joueur", () => {
    render(
      <PlayerStatusTags
        player={{ missNextMatch: true, nigglingInjuries: 1, maReduction: 1 }}
        playerId="p1"
      />,
    );
    const tags = screen.getByTestId("player-status-tags-p1").textContent ?? "";
    expect(tags).toContain("Absent");
    expect(tags).toContain("1 BP");
    expect(tags).toContain("-1 M");
  });

  it("isole les identifiants de test par joueur", () => {
    render(
      <>
        <PlayerStatusTags player={{ dead: true }} playerId="p1" />
        <PlayerStatusTags player={{ missNextMatch: true }} playerId="p2" />
      </>,
    );
    expect(screen.getByTestId("player-status-dead-p1")).toBeTruthy();
    expect(screen.getByTestId("player-status-absent-p2")).toBeTruthy();
  });
});
