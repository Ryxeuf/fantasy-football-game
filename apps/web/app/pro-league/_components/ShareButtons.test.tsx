/**
 * Tests pour `ShareButtons` (Sprint O — Lot O.D).
 *
 * Couvre :
 *   - Render des 3 boutons (Twitter, Discord, copy).
 *   - URL Twitter intent contient text + url + hashtags.
 *   - Click Discord/copy → navigator.clipboard.writeText appele +
 *     feedback affiche.
 *   - Fallback execCommand si clipboard indispo.
 *   - Mode "compact" : labels masques mais testids preservees.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import ShareButtons from "./ShareButtons";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ShareButtons — Lot O.D", () => {
  it("rend 3 boutons : tweet / discord / copy", () => {
    render(
      <ShareButtons
        url="https://example.test/x"
        text="Hello world"
      />,
    );
    expect(screen.getByTestId("share-twitter")).toBeTruthy();
    expect(screen.getByTestId("share-discord")).toBeTruthy();
    expect(screen.getByTestId("share-copy")).toBeTruthy();
  });

  it("href Twitter contient text + url + hashtags", () => {
    render(
      <ShareButtons
        url="https://example.test/x"
        text="Score 3-1 ! "
        hashtags={["bloodbowl", "nufflearena"]}
      />,
    );
    const link = screen.getByTestId("share-twitter") as HTMLAnchorElement;
    expect(link.href).toContain("twitter.com/intent/tweet");
    // URLSearchParams encode spaces as '+', decode replaces + → space
    const decoded = decodeURIComponent(link.href.replace(/\+/g, " "));
    expect(decoded).toContain("Score 3-1");
    expect(decoded).toContain("https://example.test/x");
    expect(decoded).toContain("bloodbowl,nufflearena");
  });

  it("click Discord copie URL au clipboard et affiche feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    render(
      <ShareButtons
        url="https://example.test/x"
        text="Hello"
      />,
    );
    fireEvent.click(screen.getByTestId("share-discord"));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://example.test/x");
    });
    await waitFor(() => {
      const fb = screen.getByTestId("share-feedback");
      expect(fb.textContent).toContain("Discord");
    });
  });

  it("click Copy : feedback 'Lien copié'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    render(
      <ShareButtons url="https://example.test/y" text="Hi" />,
    );
    fireEvent.click(screen.getByTestId("share-copy"));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    await waitFor(() => {
      const fb = screen.getByTestId("share-feedback");
      expect(fb.textContent).toContain("Lien copié");
    });
  });

  it("fallback execCommand si clipboard absent", async () => {
    // Pas de navigator.clipboard → fallback document.execCommand.
    Object.assign(navigator, { clipboard: undefined });
    // jsdom n'expose pas execCommand par defaut, on l'injecte.
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      writable: true,
      value: exec,
    });
    render(
      <ShareButtons url="https://example.test/z" text="Hello" />,
    );
    fireEvent.click(screen.getByTestId("share-copy"));
    await waitFor(() => {
      expect(exec).toHaveBeenCalledWith("copy");
    });
  });

  it("mode compact : icones seules, labels masques", () => {
    render(
      <ShareButtons
        url="https://example.test/x"
        text="Hi"
        layout="compact"
      />,
    );
    const twitter = screen.getByTestId("share-twitter");
    // 'Tweet' label absent en compact (juste l'icone)
    expect(twitter.textContent?.trim().toLowerCase()).not.toContain("tweet");
    // testids toujours presents pour tracking
    expect(screen.getByTestId("share-discord")).toBeTruthy();
    expect(screen.getByTestId("share-copy")).toBeTruthy();
  });
});
