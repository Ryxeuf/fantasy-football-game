/**
 * Metadata de la fiche d'équipe du coach.
 *
 * `page.tsx` est un composant client ("use client") : il ne peut pas
 * exporter `generateMetadata`. Ce layout serveur le fait à sa place —
 * même montage que `pro-league/matches/[id]` (cf. CLAUDE.md, « Convention
 * Next.js `opengraph-image.tsx` »).
 *
 * Deux invariants :
 *  1. La page est PRIVÉE : `robots: noindex` quel que soit l'état de
 *     partage (`app/robots.ts` interdit déjà `/me/`, on le redit au niveau
 *     de la page pour un lien qui arriverait par un autre chemin).
 *  2. L'aperçu n'est enrichi que si l'équipe est publique. Sinon on ne
 *     déclare RIEN : la carte générique du site (`app/opengraph-image.tsx`)
 *     s'applique, et rien du roster ne fuite.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { prettifySlug } from "../../../lib/roster-display";
import {
  buildRosterShareDescription,
  buildRosterShareTitle,
} from "../../../lib/roster-share-text";
import { fetchTeamSharePreview } from "../../../lib/team-share-preview";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr"
).replace(/\/$/, "");

/** Page privée : jamais indexée, quel que soit l'état de partage. */
const PRIVATE_ROBOTS = { index: false, follow: false } as const;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const preview = await fetchTeamSharePreview(params.id);

  if (!preview) {
    return { title: "Mon équipe", robots: PRIVATE_ROBOTS };
  }

  const race = prettifySlug(preview.roster);
  const shareTitle = buildRosterShareTitle({
    teamName: preview.name,
    raceName: race,
  });
  const description = buildRosterShareDescription({
    teamName: preview.name,
    raceName: race,
    playerCount: preview.playerCount,
    teamValue: preview.teamValue,
    description: preview.description,
  });

  return {
    // Passe par le `title.template` de `app/layout.tsx` (« %s | Nuffle
    // Arena ») ; `og:title` porte le nom du site explicitement.
    title: `${preview.name} — ${race}`,
    description,
    robots: PRIVATE_ROBOTS,
    openGraph: {
      title: shareTitle,
      description,
      type: "article",
      siteName: "Nuffle Arena",
      // On pointe la page REELLEMENT consultable : `/me/teams/:id` exige
      // une session, `/r/:token` non.
      url: preview.shareToken
        ? `${SITE_URL}/r/${preview.shareToken}`
        : `${SITE_URL}/me/teams/${params.id}`,
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
    },
  };
}

export default function TeamDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
