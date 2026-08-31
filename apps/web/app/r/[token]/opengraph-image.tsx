/**
 * Image Open Graph dynamique d'un roster partagé /r/[token].
 *
 * Auto-détectée par Next.js : override `openGraph.images` de la route.
 * « Version riche » : logo de l'équipe + nom + race + valeur d'équipe +
 * effectif, via le template OG partagé.
 *
 * Le logo est celui uploadé par le coach quand il existe, sinon l'emblème
 * programmatique du roster (`resolveTeamOgLogo`) — jamais rien, pour que la
 * carte identifie toujours l'équipe partagée. Il est posé en `contain` dans
 * une boîte carrée par `OgImageTemplate` : ses proportions sont préservées.
 */
import { ImageResponse } from "next/og";
import { fetchServerJson, getServerApiBase } from "../../lib/serverApi";
import { buildRosterShareOgContent } from "../../lib/og-image-content";
import { OgImageTemplate } from "../../lib/og-image-template";
import { resolveTeamOgLogo } from "../../lib/og-team-logo";
import { rosterPlayersOf } from "../../lib/roster-players";
import { prettifySlug } from "../../lib/roster-display";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr").replace(/\/$/, "");

export const runtime = "nodejs";
export const revalidate = 600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgTeam {
  name?: string;
  roster?: string;
  ruleset?: string;
  teamValue?: number;
  logoUrl?: string | null;
  description?: string | null;
  players?: { dead?: boolean; firedAt?: string | null }[];
  starPlayers?: { starPlayerSlug?: string }[];
}

async function fetchTeam(token: string): Promise<OgTeam | null> {
  try {
    const base = getServerApiBase();
    const data = await fetchServerJson<{ team?: OgTeam }>(
      `${base}/api/public/teams/${encodeURIComponent(token)}`,
      { next: { revalidate: 600 } },
    );
    return data?.team ?? null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: { token: string } }) {
  const team = await fetchTeam(params.token);
  const content = buildRosterShareOgContent({
    teamName: team?.name ?? "Équipe Blood Bowl",
    raceName: prettifySlug(team?.roster ?? "") || "Blood Bowl",
    teamValue: team?.teamValue ?? 1000000,
    // Effectif = joueurs encore AU ROSTER : `players.length` comptait aussi
    // les morts et les licenciés, et annonçait donc un effectif faux.
    playerCount: rosterPlayersOf(team?.players).length,
    starPlayerNames: (team?.starPlayers ?? []).map((sp) => prettifySlug(sp.starPlayerSlug ?? "")),
    ruleset: team?.ruleset ?? "season_3",
    description: team?.description,
    logo: resolveTeamOgLogo({
      logoUrl: team?.logoUrl,
      roster: team?.roster,
      assetBase: SITE_URL,
    }),
  });

  return new ImageResponse(
    (
      <OgImageTemplate content={content} canonicalUrl={`${SITE_URL}/r/${params.token}`} />
    ),
    size,
  );
}
