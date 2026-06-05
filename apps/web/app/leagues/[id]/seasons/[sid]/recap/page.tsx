"use client";
/**
 * L2.C.2c — Sprint Ligues v2 PR7 : page de recap de saison.
 *
 * Lit `GET /league/seasons/:sid/awards` (route publique livree par
 * L2.C.1c) et affiche :
 *   - en-tete avec le champion (badge or, lien vers /coach/:slug)
 *   - awards dans une grille (top scorer, basher, best defense,
 *     martyrs, cleanest sheet, mostWins) avec ties listees
 *   - tableau de classement final reutilisant SeasonStandings deja
 *     livre en PR2.
 *
 * Pas de gate par feature flag : l'endpoint est public, la page est
 * accessible meme avant le lancement du flag `league` (les recap
 * n'ont pas d'action utilisateur).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "../../../../../lib/api-client";
import { SeasonStandings } from "../../../SeasonStandings";
import type { StandingRow } from "../../../types";
import { buildSeasonEventSchema } from "../../../../season-event-schema";
import { safeJsonLd } from "../../../../../lib/safe-json-ld";

interface AwardEntry {
  teamId: string;
  teamName: string;
  roster: string;
  ownerId: string;
  coachName: string;
  value: number;
}

interface AwardsCatalogue {
  topScorer: AwardEntry[];
  bestDefense: AwardEntry[];
  basher: AwardEntry[];
  martyrs: AwardEntry[];
  cleanestSheet: AwardEntry[];
  mostWins: AwardEntry[];
}

interface RecapResponse {
  seasonId: string;
  championUserId: string | null;
  championTeamId: string | null;
  championLabel: string | null;
  awards: AwardsCatalogue;
  standings: StandingRow[];
  persistedAt: string | null;
  // L2.C.8 — meta pour le JSON-LD SEO. Optional pour
  // retro-compat avec les anciens deploys.
  leagueId?: string | null;
  leagueName?: string | null;
  seasonName?: string | null;
  seasonStatus?: string | null;
}

interface AwardCardSpec {
  key: keyof AwardsCatalogue;
  title: string;
  description: string;
  icon: string;
  emptyHint: string;
}

const AWARD_CARDS: AwardCardSpec[] = [
  {
    key: "mostWins",
    title: "Plus de victoires",
    description: "Equipes les plus titrees au tableau d'affichage.",
    icon: "🥇",
    emptyHint: "—",
  },
  {
    key: "topScorer",
    title: "Top Scorer",
    description: "Equipes qui ont marque le plus de touchdowns.",
    icon: "🏈",
    emptyHint: "Aucun touchdown marque cette saison.",
  },
  {
    key: "bestDefense",
    title: "Meilleure defense",
    description: "Moins de touchdowns encaisses.",
    icon: "🛡️",
    emptyHint: "—",
  },
  {
    key: "basher",
    title: "Basher",
    description: "Plus de sorties infligees.",
    icon: "💥",
    emptyHint: "Aucune sortie infligee cette saison.",
  },
  {
    key: "martyrs",
    title: "Les Martyrs",
    description: "Plus de sorties subies.",
    icon: "🩹",
    emptyHint: "Aucune sortie subie — saison sans casualty.",
  },
  {
    key: "cleanestSheet",
    title: "Indestructibles",
    description: "Moins de sorties subies.",
    icon: "💎",
    emptyHint: "—",
  },
];

export default function SeasonRecapPage() {
  const params = useParams();
  const leagueId = typeof params.id === "string" ? params.id : "";
  const seasonId = typeof params.sid === "string" ? params.sid : "";

  const [recap, setRecap] = useState<RecapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecap = useCallback(async () => {
    if (!seasonId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<RecapResponse>(
        `/leagues/seasons/${seasonId}/awards`,
      );
      setRecap(data);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Erreur lors du chargement du recap",
      );
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    loadRecap();
  }, [loadRecap]);

  if (loading) {
    return (
      <div className="w-full p-6">
        <p>Chargement…</p>
      </div>
    );
  }

  if (error || !recap) {
    return (
      <div data-testid="recap-error" className="w-full p-6 space-y-4">
        <p className="text-red-600">{error ?? "Recap introuvable"}</p>
        <Link
          href={`/leagues/${leagueId}`}
          className="inline-block text-sm text-blue-600 hover:underline"
        >
          ← Retour a la ligue
        </Link>
      </div>
    );
  }

  const champion =
    recap.championUserId && recap.championTeamId
      ? recap.standings.find((s) => s.teamId === recap.championTeamId) ??
        null
      : null;

  // L2.C.8 — JSON-LD SportsEvent pour les saisons cloturees avec
  // un champion identifie. baseUrl tire de NEXT_PUBLIC_SITE_URL.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://nufflearena.fr";
  const seasonEventSchema = buildSeasonEventSchema({
    baseUrl,
    leagueId: recap.leagueId ?? leagueId,
    seasonId: recap.seasonId,
    seasonName: recap.seasonName ?? "Saison",
    leagueName: recap.leagueName ?? "Ligue",
    status: recap.seasonStatus ?? "in_progress",
    endedAt: recap.persistedAt,
    championCoachName: champion?.coachName ?? null,
    championTeamName: champion?.teamName ?? null,
  });

  return (
    <div
      data-testid="season-recap-page"
      className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6"
    >
      {seasonEventSchema ? (
        <script
          type="application/ld+json"
          data-testid="season-recap-jsonld"
          // eslint-disable-next-line react/no-danger
          // Audit round 11 (HIGH/XSS) : escape via safeJsonLd pour eviter
          // le breakout `</script>` quand des champs user-controlled
          // (championCoachName, championTeamName, leagueName) contiennent
          // la sequence. Voir lib/safe-json-ld.ts (round 9).
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(seasonEventSchema),
          }}
        />
      ) : null}
      <div>
        <Link
          href={`/leagues/${leagueId}`}
          className="text-sm text-gray-600 hover:text-gray-800 inline-flex items-center gap-1"
        >
          ← Retour a la ligue
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-nuffle-anthracite mt-2">
          Recap de saison
        </h1>
      </div>

      {/* Champion banner */}
      {champion ? (
        <section
          data-testid="season-recap-champion"
          className="bg-gradient-to-r from-amber-50 to-yellow-100 border border-amber-300 rounded-xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-5xl" aria-hidden="true">
              🏆
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-amber-800 font-semibold">
                Champion de la saison
              </p>
              <p className="text-2xl font-bold text-nuffle-anthracite truncate">
                {champion.coachName ?? "Coach"}
              </p>
              <p className="text-sm text-gray-700">
                {champion.teamName}{" "}
                <span className="text-gray-500">
                  ({champion.roster})
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {champion.wins}V {champion.draws}N {champion.losses}D{" "}
                · {champion.points} pts · {champion.touchdownsFor} TD pour /{" "}
                {champion.touchdownsAgainst} TD contre
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section
          data-testid="season-recap-no-champion"
          className="bg-gray-50 border border-gray-200 rounded-lg p-4"
        >
          <p className="text-sm text-gray-600">
            Aucun champion (saison sans match joue ou non terminee).
          </p>
        </section>
      )}

      {/* Awards grid */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          Awards de la saison
        </h2>
        <ul
          data-testid="season-recap-awards-grid"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {AWARD_CARDS.map((spec) => {
            const entries = recap.awards[spec.key] ?? [];
            return (
              <li
                key={spec.key}
                data-testid={`award-card-${spec.key}`}
                className="border border-gray-200 rounded-lg bg-white p-4 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">
                    {spec.icon}
                  </span>
                  <h3 className="text-md font-semibold text-nuffle-anthracite">
                    {spec.title}
                  </h3>
                </div>
                <p className="text-xs text-gray-500">{spec.description}</p>
                {entries.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    {spec.emptyHint}
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {entries.map((e) => (
                      <li
                        key={e.teamId}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 truncate">
                          <span className="font-medium">{e.teamName}</span>{" "}
                          <span className="text-xs text-gray-500">
                            {e.coachName}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-gray-700 bg-gray-100 rounded px-1.5 py-0.5">
                          {e.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Final standings */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          Classement final
        </h2>
        <SeasonStandings rows={recap.standings} />
      </section>
    </div>
  );
}
