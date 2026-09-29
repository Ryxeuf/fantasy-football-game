import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));
const { flags } = vi.hoisted(() => ({ flags: { keys: [] as string[] } }));
vi.mock("../../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn(async () => flags.keys),
}));

import { apiRequest } from "../../lib/api-client";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { FeatureFlagProvider } from "../../contexts/FeatureFlagContext";
import { HOME_NEWS_TICKER_FLAG } from "../../lib/featureFlagKeys";
import NewsTicker from "./NewsTicker";

const mockedApiRequest = apiRequest as unknown as ReturnType<typeof vi.fn>;

function renderTicker(withProvider = true) {
  const tree = withProvider ? (
    <FeatureFlagProvider>
      <NewsTicker />
    </FeatureFlagProvider>
  ) : (
    <NewsTicker />
  );
  return render(<LanguageProvider>{tree}</LanguageProvider>);
}

describe("NewsTicker (bandeau « À la une » de la home)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiRequest.mockReset();
    flags.keys = [HOME_NEWS_TICKER_FLAG];
  });

  it("flag OFF : aucun appel API, aucun rendu", async () => {
    flags.keys = ["offline_match"];
    mockedApiRequest.mockResolvedValue({
      items: [{ kind: "blog_post", id: "b1", at: "", href: "/blog/x", title: "Article" }],
    });
    renderTicker();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedApiRequest).not.toHaveBeenCalled();
    expect(screen.queryByTestId("home-news-ticker")).toBeNull();
  });

  it("hors FeatureFlagProvider : fermé", async () => {
    mockedApiRequest.mockResolvedValue({ items: [] });
    renderTicker(false);
    await Promise.resolve();
    expect(mockedApiRequest).not.toHaveBeenCalled();
    expect(screen.queryByTestId("home-news-ticker")).toBeNull();
  });

  const RESULT_ITEM = {
    kind: "league_result",
    id: "s1",
    at: "2026-09-20T10:00:00Z",
    href: "/leagues/L1",
    title: "Ligue du Reikland",
    home: { name: "Rats", roster: "skaven" },
    away: { name: "Nains", roster: "dwarf" },
    scoreHome: 2,
    scoreAway: 1,
  };

  it("affiche les résultats en cartes et l'article sur la ligne d'actualité", async () => {
    mockedApiRequest.mockResolvedValue({
      items: [
        RESULT_ITEM,
        { kind: "blog_post", id: "b1", at: "2026-09-19T10:00:00Z", href: "/blog/saison", title: "Nouvel article" },
      ],
    });

    renderTicker();

    const ticker = await screen.findByTestId("home-news-ticker");
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/public/news-ticker");
    expect(screen.getByRole("region", { name: "À la une" })).toBeTruthy();

    const line = screen.getByTestId("home-news-ticker-headlines");
    expect(line.textContent).toContain("Nouvel article");
    expect(line.textContent).toContain("Gazette");
    // Une seule actualité : ni flèches, ni pause, ni barre de progression.
    expect(within(line).queryAllByRole("button")).toHaveLength(0);

    const card = screen.getByTestId("home-news-ticker-result");
    expect(card.getAttribute("href")).toBe("/leagues/L1");
    // Phrase complète pour les lecteurs d'écran, le visuel étant masqué.
    expect(card.textContent).toContain("Ligue du Reikland — Rats 2 – 1 Nains");
    expect(ticker.textContent).toContain("Derniers résultats");

    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/blog/saison", "/leagues/L1"]);
  });

  it("fait tourner plusieurs actualités, avec flèches et pause", async () => {
    mockedApiRequest.mockResolvedValue({
      items: [
        { kind: "blog_post", id: "b1", at: "2026-09-19T10:00:00Z", href: "/blog/a", title: "Article A" },
        {
          kind: "competition_open",
          competition: "cup",
          id: "c1",
          at: "2026-09-18T10:00:00Z",
          href: "/cups/C1",
          title: "Coupe des Brasseurs",
        },
      ],
    });

    renderTicker();

    const line = await screen.findByTestId("home-news-ticker-headlines");
    expect(line.textContent).toContain("Article A");
    expect(line.textContent).toContain("1/2");
    // Aucune carte de résultat sans résultat.
    expect(screen.queryByTestId("home-news-ticker-result")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Actualité suivante" }));
    expect(line.textContent).toContain("Coupe des Brasseurs");
    expect(line.textContent).toContain("Coupe ouverte");
    expect(line.textContent).toContain("2/2");

    // La fin de la barre de progression fait passer à l'actualité suivante.
    fireEvent.animationEnd(screen.getByTestId("home-news-ticker-progress"));
    expect(line.textContent).toContain("Article A");

    fireEvent.click(screen.getByRole("button", { name: "Actualité précédente" }));
    expect(line.textContent).toContain("Coupe des Brasseurs");

    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    expect(screen.queryByTestId("home-news-ticker-progress")).toBeNull();
    const resume = screen.getByRole("button", { name: "Reprendre le défilement" });
    expect(resume.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(resume);
    expect(screen.getByTestId("home-news-ticker-progress")).toBeTruthy();
  });

  it("n'affiche que les cartes quand il n'y a que des résultats", async () => {
    mockedApiRequest.mockResolvedValue({ items: [RESULT_ITEM] });
    renderTicker();
    await screen.findByTestId("home-news-ticker");
    expect(screen.queryByTestId("home-news-ticker-headlines")).toBeNull();
    expect(screen.getAllByTestId("home-news-ticker-result")).toHaveLength(1);
  });

  it("garde le score dans la carte malgré un nom d'équipe très long", async () => {
    mockedApiRequest.mockResolvedValue({
      items: [{ ...RESULT_ITEM, away: { name: "Kat' plakaj' é un entair'man !", roster: "lizardmen" } }],
    });
    renderTicker();
    const card = await screen.findByTestId("home-news-ticker-result");
    // Sans piste `minmax(0,1fr)`, la colonne `auto` du grid prend la largeur
    // du nom non coupé et pousse le score hors de la carte (jsdom ne fait pas
    // de mise en page : on verrouille la classe qui l'évite).
    const rows = card.querySelector(".grid");
    expect(rows?.className).toContain("grid-cols-[minmax(0,1fr)]");
    for (const row of Array.from(rows?.children ?? [])) {
      expect(row.className).toContain("min-w-0");
    }
  });

  it("donne un bloc conteneur à la bande de cartes (pas de débordement de page)", async () => {
    mockedApiRequest.mockResolvedValue({ items: [RESULT_ITEM, { ...RESULT_ITEM, id: "s2" }] });
    renderTicker();
    const card = (await screen.findAllByTestId("home-news-ticker-result"))[0];
    // Les résumés `sr-only` sont en position absolue : sans ancêtre positionné
    // DANS la bande, ils échappaient à son `overflow-x` et élargissaient la
    // page sur mobile (545 px pour un écran de 412).
    const srOnly = card.querySelector(".sr-only");
    expect(srOnly).toBeTruthy();
    const strip = card.closest("ul");
    expect(strip?.className).toMatch(/\boverflow-x-auto\b/);
    expect(strip?.className).toMatch(/\brelative\b/);
    expect(card.className).toMatch(/\brelative\b/);
  });

  it("ne rend rien quand il n'y a rien à annoncer", async () => {
    mockedApiRequest.mockResolvedValue({ items: [] });
    renderTicker();
    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalled());
    expect(screen.queryByTestId("home-news-ticker")).toBeNull();
  });

  it("ne rend rien si l'API échoue", async () => {
    mockedApiRequest.mockRejectedValue(new Error("down"));
    renderTicker();
    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalled());
    expect(screen.queryByTestId("home-news-ticker")).toBeNull();
  });
});
