/**
 * Metadata de la page publique de partage `/r/[token]`.
 *
 * Trois invariants du lot « aperçu de partage » :
 *   - `og:title` porte le nom de l'équipe ET celui du site (le
 *     `title.template` du layout racine ne s'applique qu'à `<title>`) ;
 *   - la description du coach prend la place du texte généré ;
 *   - l'effectif annoncé est celui du roster (les licenciés ne comptent
 *     pas).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { team } = vi.hoisted(() => ({ team: { current: null as unknown } }));

vi.mock("../../lib/serverApi", () => ({
  getServerApiBase: () => "http://test",
  fetchServerJson: vi.fn(async () =>
    team.current ? { team: team.current } : null,
  ),
  safeServerJson: vi.fn(async () =>
    team.current ? { team: team.current } : null,
  ),
}));

import { generateMetadata } from "./page";

const TEAM = {
  id: "team-1",
  name: "Les Rats Véloces",
  roster: "skaven",
  ruleset: "season_3",
  teamValue: 1_150_000,
  treasury: 0,
  rerolls: 2,
  cheerleaders: 0,
  assistants: 0,
  apothecary: true,
  dedicatedFans: 1,
  description: null as string | null,
  logoUrl: null as string | null,
  players: [
    { id: "p1", dead: false, firedAt: null },
    { id: "p2", dead: false, firedAt: null },
    // Licencié : ne fait plus partie de l'effectif annoncé.
    { id: "p3", dead: false, firedAt: "2026-08-01T00:00:00.000Z" },
  ],
  starPlayers: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  team.current = TEAM;
});

describe("generateMetadata (/r/[token])", () => {
  it("porte le nom de l'équipe ET le nom du site dans og:title", async () => {
    const meta = await generateMetadata({ params: { token: "tok" } });
    expect(meta.openGraph?.title).toBe(
      "Les Rats Véloces — Skaven | Nuffle Arena",
    );
    expect(meta.twitter?.title).toBe(meta.openGraph?.title);
  });

  it("ne compte pas les licenciés dans l'effectif annoncé", async () => {
    const meta = await generateMetadata({ params: { token: "tok" } });
    expect(String(meta.description)).toContain("2 joueurs");
  });

  it("sert la description du coach quand elle existe", async () => {
    team.current = { ...TEAM, description: "Fluff maison." };
    const meta = await generateMetadata({ params: { token: "tok" } });
    expect(meta.description).toBe("Fluff maison.");
    expect(meta.openGraph?.description).toBe("Fluff maison.");
  });

  it("rend une page noindex pour un token inconnu", async () => {
    team.current = null;
    const meta = await generateMetadata({ params: { token: "inconnu" } });
    expect(meta.robots).toMatchObject({ index: false });
  });
});
