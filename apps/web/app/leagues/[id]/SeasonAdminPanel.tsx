"use client";
import { useCallback, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import type { LeagueSeasonStatus } from "./types";

// Sprint Ligues v2 PR2 — panneau admin saison.
// Boutons gates par status :
//   - Open registrations : visible uniquement si status === draft
//   - Start season       : visible si scheduled (ou draft : autorise
//                          aussi cote backend, on ne le bloque pas en
//                          UI pour les tests)
//   - Regenerate         : visible tant que la saison n'est pas
//                          completed et qu'aucun match n'a ete joue
//                          (la verification finale reste serveur)
//   - Close              : visible si in_progress ou scheduled
//
// Le composant est rendu uniquement par le parent quand
//   `isCreator && v2UiEnabled` est vrai. Pas de second gate ici.

interface SeasonAdminPanelProps {
  seasonId: string;
  status: LeagueSeasonStatus | string;
  onActionDone: () => void;
}

type AdminAction = "open" | "start" | "regenerate" | "close";

export function SeasonAdminPanel({
  seasonId,
  status,
  onActionDone,
}: SeasonAdminPanelProps) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<AdminAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [doubleRoundRobin, setDoubleRoundRobin] = useState(false);
  // Champ "Durée d'une journée" masqué pour le moment : valeur vide par
  // défaut => roundDurationDays envoyé à null (pas de deadline / forfait auto).
  const [roundDurationDays, setRoundDurationDays] = useState<number | "">("");

  const runAction = useCallback(
    async (action: AdminAction, body?: Record<string, unknown>) => {
      setBusy(action);
      setError(null);
      setSuccess(null);
      try {
        await apiRequest(`/leagues/seasons/${seasonId}/${action}`, {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        });
        setSuccess(t.leagues.adminActionSuccess);
        onActionDone();
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : t.leagues.adminActionError,
        );
      } finally {
        setBusy(null);
      }
    },
    [
      seasonId,
      onActionDone,
      t.leagues.adminActionSuccess,
      t.leagues.adminActionError,
    ],
  );

  const onOpen = useCallback(() => runAction("open"), [runAction]);
  const onStart = useCallback(
    () =>
      runAction("start", {
        doubleRoundRobin,
        roundDurationDays:
          typeof roundDurationDays === "number" ? roundDurationDays : null,
      }),
    [runAction, doubleRoundRobin, roundDurationDays],
  );
  const onRegenerate = useCallback(() => {
    if (!confirm(t.leagues.adminSeasonConfirmRegenerate)) return;
    runAction("regenerate", {
      doubleRoundRobin,
      roundDurationDays:
        typeof roundDurationDays === "number" ? roundDurationDays : null,
    });
  }, [
    runAction,
    doubleRoundRobin,
    roundDurationDays,
    t.leagues.adminSeasonConfirmRegenerate,
  ]);
  const onClose = useCallback(() => {
    if (!confirm(t.leagues.adminSeasonConfirmClose)) return;
    runAction("close");
  }, [runAction, t.leagues.adminSeasonConfirmClose]);

  const canOpen = status === "draft";
  const canStart = status === "draft" || status === "scheduled";
  const canRegenerate = status !== "completed";
  const canClose = status === "scheduled" || status === "in_progress";

  return (
    <section
      data-testid="season-admin-panel"
      className="border border-amber-200 bg-amber-50/40 rounded-lg p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wide">
          {t.leagues.adminSeasonTitle}
        </h3>
      </div>

      {error ? (
        <div
          data-testid="admin-action-error"
          className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          data-testid="admin-action-success"
          className="rounded border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm"
        >
          {success}
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        {/* Champ "Durée d'une journée" masqué temporairement. */}
        <label className="inline-flex items-center text-sm sm:col-span-2 mt-3">
          <input
            data-testid="admin-double-round-robin"
            type="checkbox"
            checked={doubleRoundRobin}
            onChange={(e) => setDoubleRoundRobin(e.target.checked)}
            className="mr-2"
          />
          {t.leagues.newSeasonDoubleRoundRobinLabel}
        </label>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {canOpen ? (
          <button
            type="button"
            data-testid="admin-action-open"
            onClick={onOpen}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-md bg-white border border-amber-400 text-amber-900 text-sm hover:bg-amber-100 disabled:opacity-50"
          >
            {t.leagues.adminSeasonOpen}
          </button>
        ) : null}
        {canStart ? (
          <button
            type="button"
            data-testid="admin-action-start"
            onClick={onStart}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-md bg-nuffle-gold text-white text-sm font-medium hover:bg-nuffle-gold/90 disabled:opacity-50"
          >
            {t.leagues.adminSeasonStart}
          </button>
        ) : null}
        {canRegenerate ? (
          <button
            type="button"
            data-testid="admin-action-regenerate"
            onClick={onRegenerate}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {t.leagues.adminSeasonRegenerate}
          </button>
        ) : null}
        {canClose ? (
          <button
            type="button"
            data-testid="admin-action-close"
            onClick={onClose}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-md bg-white border border-red-300 text-red-700 text-sm hover:bg-red-50 disabled:opacity-50"
          >
            {t.leagues.adminSeasonClose}
          </button>
        ) : null}
      </div>
    </section>
  );
}
