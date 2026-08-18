import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { StarPlayerDefinition } from "@bb/game-engine";
import StarPlayerCard, { type StarPlayerWithKeywords } from "./StarPlayerCard";
import { LanguageProvider } from "../contexts/LanguageContext";

const GRIFF: StarPlayerWithKeywords = {
  slug: "griff_oberwald",
  displayName: "Griff Oberwald",
  cost: 280000,
  ma: 7,
  st: 4,
  ag: 2,
  pa: 4,
  av: 9,
  skills: "block,dodge",
  hirableBy: ["old_world_classic"],
  keywords: "Humain, Blitzer",
  keywordsEn: "Human, Blitzer",
} as StarPlayerDefinition & { keywordsEn?: string | null };

afterEach(() => {
  localStorage.clear();
});

describe("StarPlayerCard — mots-clés", () => {
  it("affiche une pastille par mot-clé (FR par défaut)", () => {
    render(
      <LanguageProvider>
        <StarPlayerCard starPlayer={GRIFF} />
      </LanguageProvider>,
    );
    const chips = screen.getByTestId("star-player-keywords");
    expect(chips.textContent).toContain("Humain");
    expect(chips.textContent).toContain("Blitzer");
    expect(chips.children).toHaveLength(2);
  });

  it("bascule sur les mots-clés traduits en anglais", async () => {
    localStorage.setItem("language", "en");
    render(
      <LanguageProvider>
        <StarPlayerCard starPlayer={GRIFF} />
      </LanguageProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("star-player-keywords").textContent).toContain(
        "Human",
      );
    });
  });

  it("n'affiche rien quand le star player n'a pas de mots-clés", () => {
    render(
      <LanguageProvider>
        <StarPlayerCard
          starPlayer={{ ...GRIFF, keywords: undefined, keywordsEn: null }}
        />
      </LanguageProvider>,
    );
    expect(screen.queryByTestId("star-player-keywords")).toBeNull();
  });
});
