"use client";
import type { Route } from "next";
import { useCallback, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../../lib/api-client";
import { StandingsOrderField } from "../../_components/StandingsOrderField";
import { PredictionsScopeField } from "../../_components/PredictionsScopeField";
import type { PredictionScope } from "../../_components/predictions";

/**
 * Réglages d'une ligue VERROUILLÉE (au moins un match joué).
 *
 * Le formulaire complet est gelé — y toucher au barème, aux rosters ou aux
 * règles de bonus réécrirait des points déjà attribués. L'ordre de
 * CLASSEMENT, lui, est appliqué au tri, à la lecture : rien de persisté n'en
 * dépend, donc le commissaire le garde en main. Avant, la page entière était
 * masquée dans ce cas et il n'existait AUCUN accès — d'où un réglage
 * annoncé mais introuvable.
 *
 * `PATCH /leagues/:id/standings-order` (commissaire ou admin) ignore le
 * verrou. Même posture pour la portée des PRONOSTICS
 * (`PATCH /leagues/:id/predictions-scope`) : elle ne réécrit aucun point de
 * classement. Chaque réglage garde son bouton — un échec de l'un ne doit pas
 * laisser croire l'autre enregistré.
 */

interface LockedLeagueSettingsProps {
  leagueId: string;
  /** Critères CONFIGURÉS (pas l'ordre effectif) : vide = ordre par défaut. */
  initialRules: readonly string[];
  /** Portée EFFECTIVE des pronostics (une ligue antérieure lit « off »). */
  initialPredictionsScope: PredictionScope;
  /** Visibilité de la ligue, pour l'indice de la portée « Tout le monde ». */
  isPublic: boolean;
  /**
   * `Route<T>` exige le motif exact d'une route dynamique (`typedRoutes`),
   * d'où le gabarit plutôt qu'un `string` trop large.
   */
  backHref: Route<`/leagues/${string}`>;
}

export function LockedLeagueSettings({
  leagueId,
  initialRules,
  initialPredictionsScope,
  isPublic,
  backHref,
}: LockedLeagueSettingsProps) {
  const [rules, setRules] = useState<string[]>([...initialRules]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiRequest(`/leagues/${leagueId}/standings-order`, {
        method: "PATCH",
        // `null` = aucun critère retenu : retour à l'ordre par défaut.
        body: JSON.stringify({
          tieBreakRules: rules.length > 0 ? rules : null,
        }),
      });
      setSaved(true);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Enregistrement impossible",
      );
    } finally {
      setSaving(false);
    }
  }, [leagueId, rules]);

  return (
    <div data-testid="locked-league-settings" className="space-y-5">
      <p
        data-testid="league-locked-notice"
        className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3"
      >
        Un match a déjà été joué : les paramètres de la ligue (barème, rosters
        autorisés, points bonus) sont figés, sans quoi des points déjà
        attribués seraient réécrits. L&apos;ordre du classement et les
        pronostics, eux, restent modifiables — ils ne réécrivent aucun point.
      </p>

      <StandingsOrderField
        value={rules}
        onChange={(next) => {
          setRules(next);
          setSaved(false);
        }}
        disabled={saving}
      />

      {error ? (
        <div
          data-testid="locked-settings-error"
          className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}
      {saved ? (
        <p
          data-testid="locked-settings-saved"
          className="text-sm text-green-700"
        >
          Ordre de classement enregistré. Il s&apos;applique au prochain
          affichage du classement.
        </p>
      ) : null}

      <button
        type="button"
        data-testid="locked-settings-submit"
        disabled={saving}
        onClick={handleSave}
        className="px-4 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : "Enregistrer l'ordre"}
      </button>

      <LockedPredictionsScope
        leagueId={leagueId}
        initialScope={initialPredictionsScope}
        isPublic={isPublic}
      />

      <div className="pt-2">
        <Link
          href={backHref}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Retour à la ligue
        </Link>
      </div>
    </div>
  );
}

interface LockedPredictionsScopeProps {
  leagueId: string;
  initialScope: PredictionScope;
  isPublic: boolean;
}

/** Portée des pronostics d'une ligue verrouillée, enregistrée à part. */
function LockedPredictionsScope({
  leagueId,
  initialScope,
  isPublic,
}: LockedPredictionsScopeProps) {
  const [scope, setScope] = useState<PredictionScope>(initialScope);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiRequest(`/leagues/${leagueId}/predictions-scope`, {
        method: "PATCH",
        body: JSON.stringify({ scope }),
      });
      setSaved(true);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Enregistrement impossible",
      );
    } finally {
      setSaving(false);
    }
  }, [leagueId, scope]);

  return (
    <div
      data-testid="locked-predictions-settings"
      className="space-y-3 border-t border-gray-200 pt-5"
    >
      <PredictionsScopeField
        value={scope}
        onChange={(next) => {
          setScope(next);
          setSaved(false);
        }}
        isPublic={isPublic}
        disabled={saving}
      />
      {error ? (
        <div
          data-testid="locked-predictions-error"
          className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}
      {saved ? (
        <p
          data-testid="locked-predictions-saved"
          className="text-sm text-green-700"
        >
          Portée des pronostics enregistrée.
        </p>
      ) : null}
      <button
        type="button"
        data-testid="locked-predictions-submit"
        disabled={saving}
        onClick={handleSave}
        className="px-4 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : "Enregistrer les pronostics"}
      </button>
    </div>
  );
}
