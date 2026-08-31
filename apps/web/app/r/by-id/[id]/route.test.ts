/**
 * Résolveur `/r/by-id/[id]` — cible du détournement de `/me/teams/:id`.
 *
 * L'invariant qui compte : une équipe PUBLIQUE part vers sa page publique
 * (c'est ce qui rend l'aperçu de partage possible), tout le reste reconduit
 * le parcours de connexion — sans jamais suivre une URL fournie par
 * l'appelant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { preview } = vi.hoisted(() => ({ preview: { current: null as unknown } }));

vi.mock("../../../lib/team-share-preview", () => ({
  fetchTeamSharePreview: vi.fn(async () => preview.current),
}));

import { fetchTeamSharePreview } from "../../../lib/team-share-preview";
import { GET } from "./route";

const PUBLIC_PREVIEW = {
  id: "team-1",
  name: "Les Rats Véloces",
  roster: "skaven",
  ruleset: "season_3",
  teamValue: 1_150_000,
  playerCount: 13,
  starPlayerNames: [],
  logoUrl: null,
  description: null,
  shareToken: "tok123",
};

function request(url: string): NextRequest {
  return new NextRequest(new Request(url));
}

beforeEach(() => {
  vi.clearAllMocks();
  preview.current = null;
});

describe("GET /r/by-id/[id]", () => {
  it("renvoie une équipe publique vers sa page publique", async () => {
    preview.current = PUBLIC_PREVIEW;

    const res = await GET(
      request("https://nufflearena.fr/r/by-id/team-1?sync=1"),
      { params: { id: "team-1" } },
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://nufflearena.fr/r/tok123");
    expect(fetchTeamSharePreview).toHaveBeenCalledWith("team-1");
  });

  it("reconduit /auth/sync quand le middleware n'avait pas de cookie", async () => {
    const res = await GET(
      request("https://nufflearena.fr/r/by-id/team-1?sync=1"),
      { params: { id: "team-1" } },
    );

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/auth/sync");
    expect(location.searchParams.get("redirect")).toBe("/me/teams/team-1");
  });

  it("reconduit /login quand un cookie invalide était présent", async () => {
    const res = await GET(request("https://nufflearena.fr/r/by-id/team-1"), {
      params: { id: "team-1" },
    });

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe("/me/teams/team-1");
  });

  it("ne suit jamais une destination fournie par l'appelant", async () => {
    const res = await GET(
      request(
        "https://nufflearena.fr/r/by-id/team-1?redirect=https://evil.example",
      ),
      { params: { id: "team-1" } },
    );

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin).toBe("https://nufflearena.fr");
    expect(location.searchParams.get("redirect")).toBe("/me/teams/team-1");
  });

  it("reconduit la connexion pour une équipe publique sans token", async () => {
    // Partage désactivé après coup : `isPublic` est faux côté API, donc
    // l'aperçu est nul — mais on couvre aussi la forme dégradée.
    preview.current = { ...PUBLIC_PREVIEW, shareToken: null };

    const res = await GET(request("https://nufflearena.fr/r/by-id/team-1"), {
      params: { id: "team-1" },
    });

    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
  });
});
