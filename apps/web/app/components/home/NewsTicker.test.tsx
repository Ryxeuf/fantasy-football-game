import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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

  it("affiche résultats et article, liens compris", async () => {
    mockedApiRequest.mockResolvedValue({
      items: [
        {
          kind: "league_result",
          id: "s1",
          at: "2026-09-20T10:00:00Z",
          href: "/leagues/L1",
          title: "Ligue du Reikland",
          home: { name: "Rats", roster: "skaven" },
          away: { name: "Nains", roster: "dwarf" },
          scoreHome: 2,
          scoreAway: 1,
        },
        { kind: "blog_post", id: "b1", at: "2026-09-19T10:00:00Z", href: "/blog/saison", title: "Nouvel article" },
      ],
    });

    renderTicker();

    const ticker = await screen.findByTestId("home-news-ticker");
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/public/news-ticker");
    expect(ticker.textContent).toContain("Rats 2 – 1 Nains");
    expect(ticker.textContent).toContain("Nouvel article");
    // Libellé accessible + une seule copie lisible (la copie de boucle est aria-hidden).
    expect(screen.getByRole("region", { name: "À la une" })).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/leagues/L1", "/blog/saison"]);
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
