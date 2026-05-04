"use client";
/**
 * L2.B.4b — Sprint Ligues v2 PR5 : banner d'invitation au level-up.
 *
 * Affiche un encart clickable vers `/me/teams/:id/level-up` quand
 * `GET /team/:teamId/pending-advancements` retourne au moins une
 * entree. Gate par `useFeatureFlag(LEAGUES_V2_UI_FLAG)` cote parent.
 *
 * Erreur reseau silencieuse : la banner est non-critique, mieux vaut
 * la masquer que d'afficher un toast d'erreur a chaque chargement.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../../lib/api-client";
import { useLanguage } from "../../../contexts/LanguageContext";

interface PendingItem {
  teamPlayerId: string;
}

interface PendingResponse {
  teamId: string;
  items: PendingItem[];
}

interface Props {
  teamId: string;
}

export function PendingAdvancementsBanner({ teamId }: Props) {
  const { t } = useLanguage();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    async function fetchPending() {
      try {
        const data = await apiRequest<PendingResponse>(
          `/team/${teamId}/pending-advancements`,
        );
        if (!cancelled) setCount(data.items?.length ?? 0);
      } catch {
        if (!cancelled) setCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPending();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loading || count === 0) return null;

  return (
    <Link
      href={`/me/teams/${teamId}/level-up`}
      data-testid="pending-advancements-banner"
      className="block rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-amber-900">
            ⭐{" "}
            {(t.teams.pendingAdvancementsBanner ??
              "{count} joueur(s) en attente d'amelioration").replace(
              "{count}",
              String(count),
            )}
          </div>
          <div className="text-xs text-amber-700 mt-0.5">
            {t.teams.pendingAdvancementsBannerCta ??
              "Cliquer pour leur attribuer une nouvelle competence."}
          </div>
        </div>
        <span className="text-amber-700 text-2xl">→</span>
      </div>
    </Link>
  );
}
