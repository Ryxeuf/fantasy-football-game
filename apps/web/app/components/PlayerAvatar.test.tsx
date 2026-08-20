import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerAvatar, { playerInitials } from "./PlayerAvatar";

describe("playerInitials", () => {
  it("prend la 1re lettre du prénom et du dernier nom", () => {
    expect(playerInitials("Boris le Rapide")).toBe("BR");
    expect(playerInitials("Griff")).toBe("G");
    expect(playerInitials("  ")).toBe("?");
    expect(playerInitials("jean-claude van damme")).toBe("JD");
  });
});

describe("PlayerAvatar", () => {
  it("affiche les initiales par défaut (pas d'image)", () => {
    render(<PlayerAvatar name="Boris le Rapide" />);
    const el = screen.getByTestId("player-avatar-initials");
    expect(el.textContent).toBe("BR");
  });

  it("affiche la photo quand imageUrl est fournie", () => {
    render(
      <PlayerAvatar
        name="Boris"
        imageUrl="/images/player-images/boris-abcdef123456.png"
        size={40}
      />,
    );
    const img = screen.getByTestId("player-avatar-img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(
      "/images/player-images/boris-abcdef123456.png",
    );
    expect(img.getAttribute("alt")).toBe("Boris");
    expect(screen.queryByTestId("player-avatar-initials")).toBeNull();
  });
});
