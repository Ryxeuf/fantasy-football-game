/**
 * Layout server-side du match Pro League — Sprint O (Lot O.D).
 *
 * Existait deja en tant que client-page `page.tsx`. Le layout permet
 * d'ajouter `generateMetadata` (openGraph + twitter card avec
 * og-image dynamique) sans toucher au "use client" de la page.
 *
 * L'OG image est generee automatiquement par Next.js via
 * `[id]/opengraph-image.tsx` (convention App Router).
 */
import type { Metadata, ResolvingMetadata } from "next";

import { fetchServerJson, getServerApiBase } from "../../../lib/serverApi";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

interface MatchPayloadForMeta {
  roundNumber: number;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  homeTeam: { name: string; city: string };
  awayTeam: { name: string; city: string };
}

export async function generateMetadata(
  { params }: { params: { id: string } },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const url = `${SITE_URL.replace(/\/$/, "")}/pro-league/matches/${params.id}`;
  let payload: MatchPayloadForMeta | null = null;
  try {
    const base = getServerApiBase();
    payload = await fetchServerJson<MatchPayloadForMeta>(
      `${base}/pro-league/matches/${encodeURIComponent(params.id)}`,
      { next: { revalidate: 300 } },
    );
  } catch {
    // Fallback: meta generiques en bas de fonction.
  }

  if (!payload) {
    return {
      title: "Match Pro League — Nuffle Arena",
      description:
        "Suivez ce match Pro League en direct ou rejouez-le : score, paris, highlights et Gazette quotidienne.",
      alternates: { canonical: url },
      openGraph: {
        title: "Match Pro League — Nuffle Arena",
        description:
          "Suivez ce match Pro League en direct ou rejouez-le.",
        type: "website",
        url,
      },
      twitter: { card: "summary_large_image" },
    };
  }

  const hasScore =
    payload.scoreHome !== null && payload.scoreAway !== null;
  const scorePart = hasScore
    ? `${payload.scoreHome}–${payload.scoreAway}`
    : "vs";
  const title = `${payload.homeTeam.name} ${scorePart} ${payload.awayTeam.name} — Pro League`;
  const statusLabel =
    payload.status === "in_progress"
      ? "EN DIRECT"
      : payload.status === "completed"
        ? "Terminé"
        : "À venir";
  const description = `R${payload.roundNumber} · ${statusLabel} · ${payload.homeTeam.city} reçoit ${payload.awayTeam.city}. Suis le match live, parie, lis la Gazette quotidienne.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      // L'image est resolue par opengraph-image.tsx voisin (1200×630).
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function MatchLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
