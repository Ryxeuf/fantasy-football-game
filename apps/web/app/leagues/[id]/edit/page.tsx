"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../../lib/api-client";
import { useLanguage } from "../../../contexts/LanguageContext";
import {
  LeagueForm,
  type LeagueFormValues,
} from "../../_components/LeagueForm";
import type { LeagueDetail } from "../types";

// L2.D — Edition d'une ligue par son commissaire (createur). Reutilise
// `LeagueForm` (mutualise avec la creation). Accessible uniquement au
// createur ET tant qu'aucun match n'a ete joue (`hasScoredMatch`). Les
// deux gardes sont aussi appliquees cote serveur (PATCH /leagues/:id) ;
// ici on redirige tot pour ne pas afficher un formulaire inutilisable.

interface MeResponse {
  user: { id: string } | null;
}

export default function EditLeaguePage() {
  const router = useRouter();
  const params = useParams();
  const leagueId = typeof params.id === "string" ? params.id : "";
  const { t } = useLanguage();

  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [me, body] = await Promise.all([
          apiRequest<MeResponse>("/auth/me").catch(
            () => ({ user: null }) as MeResponse,
          ),
          apiRequest<{ league: LeagueDetail }>(`/leagues/${leagueId}`),
        ]);
        if (cancelled) return;
        setCurrentUserId(me.user?.id ?? null);
        setLeague(body.league);
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : t.leagues.errorLoad,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (leagueId) load();
    return () => {
      cancelled = true;
    };
  }, [leagueId, t.leagues.errorLoad]);

  // Redirection si l'utilisateur n'est pas le commissaire ou si la ligue
  // est verrouillee (match deja joue).
  useEffect(() => {
    if (loading || !league) return;
    const isCreator =
      currentUserId !== null && league.creatorId === currentUserId;
    if (!isCreator || league.hasScoredMatch) {
      router.replace(`/leagues/${leagueId}`);
    }
  }, [loading, league, currentUserId, leagueId, router]);

  const handleSubmit = useCallback(
    async (values: LeagueFormValues) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiRequest(`/leagues/${leagueId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: values.name.trim(),
            description: values.description.trim() || null,
            ruleset: values.ruleset,
            isPublic: values.isPublic,
            maxParticipants: values.maxParticipants,
            allowedRosters:
              values.allowedRosters.length > 0 ? values.allowedRosters : null,
            winPoints: values.winPoints,
            drawPoints: values.drawPoints,
            lossPoints: values.lossPoints,
            forfeitPoints: values.forfeitPoints,
          }),
        });
        router.push(`/leagues/${leagueId}`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t.leagues.formSubmitError);
        setSubmitting(false);
      }
    },
    [leagueId, router, t.leagues.formSubmitError],
  );

  if (loading) {
    return (
      <div className="w-full p-6">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  if (loadError || !league) {
    return (
      <div className="w-full p-6">
        <p className="text-red-600">
          {t.common.error} : {loadError ?? t.leagues.errorLoad}
        </p>
      </div>
    );
  }

  const isCreator =
    currentUserId !== null && league.creatorId === currentUserId;
  // Pendant que le useEffect de redirection s'execute, on ne rend pas le
  // formulaire pour un non-createur / ligue verrouillee.
  if (!isCreator || league.hasScoredMatch) {
    return null;
  }

  return (
    <div
      data-testid="edit-league-page"
      className="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-6"
    >
      <div>
        <Link
          href={`/leagues/${leagueId}`}
          className="text-sm text-gray-600 hover:text-gray-800 inline-flex items-center gap-1"
        >
          ← {t.leagues.backToLeague}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-nuffle-anthracite mt-2">
          {t.leagues.editLeagueTitle}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {t.leagues.editLeagueDescription}
        </p>
      </div>

      <LeagueForm
        mode="edit"
        submitting={submitting}
        error={error}
        cancelHref={`/leagues/${leagueId}`}
        initialValues={{
          name: league.name,
          description: league.description ?? "",
          ruleset:
            league.ruleset === "season_2" ? "season_2" : "season_3",
          isPublic: league.isPublic,
          maxParticipants: league.maxParticipants,
          allowedRosters: league.allowedRosters ?? [],
          winPoints: league.winPoints,
          drawPoints: league.drawPoints,
          lossPoints: league.lossPoints,
          forfeitPoints: league.forfeitPoints,
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
