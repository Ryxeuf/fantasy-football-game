/**
 * Metadata de la fiche `/me/teams/[id]`.
 *
 * Ce qui est vérifié ici, c'est surtout la GATE : la fiche est privée, et
 * seule une équipe ayant activé le partage public a le droit d'exposer son
 * nom, son logo et son fluff dans l'aperçu d'un lien collé dans un salon.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { preview } = vi.hoisted(() => ({
  preview: { current: null as unknown },
}));

vi.mock("../../../lib/serverApi", () => ({
  getServerApiBase: () => "http://test",
  safeServerJson: vi.fn(async () =>
    preview.current ? { preview: preview.current } : null,
  ),
}));

import { safeServerJson } from "../../../lib/serverApi";
import { generateMetadata } from "./layout";

const PUBLIC_TEAM = {
  id: "team-1",
  name: "Les Rats Véloces",
  roster: "skaven",
  ruleset: "season_3",
  teamValue: 1_150_000,
  playerCount: 13,
  starPlayerNames: ["hakflem_skuttlespike"],
  logoUrl: "/images/team-logos/rats.png",
  description: "Une bande de rats qui court plus vite que son ombre.",
  shareToken: "tok123",
};

beforeEach(() => {
  vi.clearAllMocks();
  preview.current = null;
});

describe("generateMetadata (/me/teams/[id])", () => {
  it("reste noindex : la fiche est privée", async () => {
    preview.current = PUBLIC_TEAM;
    const meta = await generateMetadata({ params: { id: "team-1" } });
    expect(meta.robots).toMatchObject({ index: false });
  });

  it("noindex aussi quand l'équipe n'est pas partagée", async () => {
    const meta = await generateMetadata({ params: { id: "team-1" } });
    expect(meta.robots).toMatchObject({ index: false });
  });

  it("porte le nom de l'équipe ET le nom du site dans og:title", async () => {
    preview.current = PUBLIC_TEAM;
    const meta = await generateMetadata({ params: { id: "team-1" } });
    expect(meta.openGraph?.title).toBe(
      "Les Rats Véloces — Skaven | Nuffle Arena",
    );
    expect(String(meta.title)).toContain("Les Rats Véloces");
  });

  it("sert la description du coach comme texte d'aperçu", async () => {
    preview.current = PUBLIC_TEAM;
    const meta = await generateMetadata({ params: { id: "team-1" } });
    expect(meta.description).toBe(
      "Une bande de rats qui court plus vite que son ombre.",
    );
    expect(meta.openGraph?.description).toBe(meta.description);
  });

  it("retombe sur la description générée sans fluff", async () => {
    preview.current = { ...PUBLIC_TEAM, description: null };
    const meta = await generateMetadata({ params: { id: "team-1" } });
    expect(String(meta.description)).toContain("13 joueurs");
    expect(String(meta.description)).toContain("Skaven");
  });

  it("pointe og:url vers la page publique, pas vers la fiche privée", async () => {
    preview.current = PUBLIC_TEAM;
    const meta = await generateMetadata({ params: { id: "team-1" } });
    expect(String(meta.openGraph?.url)).toContain("/r/tok123");
  });

  it("ne révèle rien quand l'équipe n'est pas publique", async () => {
    const meta = await generateMetadata({ params: { id: "team-1" } });
    expect(meta.openGraph).toBeUndefined();
    expect(meta.description).toBeUndefined();
    expect(String(meta.title)).not.toContain("Rats");
  });

  it("dégrade sans planter quand l'API est injoignable", async () => {
    vi.mocked(safeServerJson).mockResolvedValueOnce(null);
    const meta = await generateMetadata({ params: { id: "team-1" } });
    expect(meta.robots).toMatchObject({ index: false });
    expect(meta.openGraph).toBeUndefined();
  });
});
