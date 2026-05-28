"use client";

import { useCallback, useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../lib/api-client";

interface NflWeekRow {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  isPlayoffs: boolean;
}

interface WeeksResponse {
  weeks: NflWeekRow[];
}

interface TestModeControlPanelProps {
  leagueId: string;
  status: "draft" | "in_progress" | "completed";
  onMutated: () => void;
}

/**
 * Panel de pilotage pour les championnats de test. Permet a l'owner
 * d'enchainer les etapes habituellement automatisees par les ticks
 * cron (ingest stats, lock lineups, generate matchups, settle week)
 * pour derouler une saison passee a son rythme.
 *
 * Gate cote serveur : owner + feature flag `nuffle_coach_test`.
 * Cote UI : la page parent ne monte ce panel que si le flag est ON.
 */
export default function TestModeControlPanel({
  leagueId,
  status,
  onMutated,
}: TestModeControlPanelProps) {
  const [weeks, setWeeks] = useState<NflWeekRow[] | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{
    label: string;
    summary: string;
  } | null>(null);

  const loadWeeks = useCallback(async () => {
    try {
      const out = await apiRequest<WeeksResponse>(
        `/api/nfl-fantasy/leagues/${leagueId}/test/weeks`,
      );
      setWeeks(out.weeks);
      if (out.weeks.length > 0 && !selectedWeekId) {
        setSelectedWeekId(out.weeks[0].id);
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        setError("Mode test non actif pour ce compte.");
      } else {
        setError(err instanceof Error ? err.message : "Erreur chargement weeks");
      }
    }
  }, [leagueId, selectedWeekId]);

  useEffect(() => {
    void loadWeeks();
  }, [loadWeeks]);

  async function callAction(
    label: string,
    path: string,
    requiresWeek: boolean,
  ): Promise<void> {
    setError(null);
    setBusy(label);
    setLastAction(null);
    try {
      const body = requiresWeek
        ? JSON.stringify({ weekId: selectedWeekId })
        : undefined;
      const out = await apiRequest<Record<string, unknown>>(
        `/api/nfl-fantasy/leagues/${leagueId}${path}`,
        { method: "POST", ...(body ? { body } : {}) },
      );
      setLastAction({ label, summary: summarize(out) });
      onMutated();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${label} : ${err.message} (${err.status})`);
      } else {
        setError(`${label} : ${err instanceof Error ? err.message : "Erreur"}`);
      }
    } finally {
      setBusy(null);
    }
  }

  const isDraft = status === "draft";
  const canRunWeekActions =
    status === "in_progress" && selectedWeekId.length > 0;

  return (
    <section
      className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50/60 p-4"
      data-testid="test-mode-control-panel"
    >
      <h2 className="text-base font-semibold text-amber-900">
        🧪 Mode test — Pilotage saison
      </h2>
      <p className="mt-1 text-xs text-amber-900/80">
        Bypass des cron : permet a l&apos;owner de derouler manuellement
        une saison passee.
      </p>

      {error && (
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {lastAction && (
        <div
          className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800"
          data-testid="test-mode-last-action"
        >
          ✓ <strong>{lastAction.label}</strong> · {lastAction.summary}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {/* Lifecycle */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">
            1. Demarrage saison
          </h3>
          <button
            onClick={() =>
              callAction("Demarrer la saison", "/start-season", false)
            }
            disabled={!isDraft || busy !== null}
            className="mt-2 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="test-start-season"
          >
            {busy === "Demarrer la saison"
              ? "Demarrage…"
              : "Demarrer la saison (draft → in_progress)"}
          </button>
          {!isDraft && (
            <p className="mt-1 text-xs text-amber-900/60">
              Status actuel : {status}. Bouton dispo uniquement en
              &quot;draft&quot;.
            </p>
          )}
        </div>

        {/* Per-week actions */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">
            2. Pilotage semaine par semaine
          </h3>
          {weeks === null && (
            <p className="mt-2 text-xs text-amber-900/60">Chargement…</p>
          )}
          {weeks !== null && weeks.length === 0 && (
            <p className="mt-2 text-xs text-amber-900/60">
              Aucune semaine dans ce cycle (pas de cycle adosse ?).
            </p>
          )}
          {weeks !== null && weeks.length > 0 && (
            <>
              <div className="mt-2 flex items-center gap-2">
                <label
                  htmlFor="test-week-picker"
                  className="text-xs font-medium text-amber-900"
                >
                  Semaine :
                </label>
                <select
                  id="test-week-picker"
                  value={selectedWeekId}
                  onChange={(e) => setSelectedWeekId(e.target.value)}
                  className="rounded-md border border-amber-400 bg-white px-2 py-1 text-sm"
                  data-testid="test-week-picker"
                >
                  {weeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      W{w.weekNumber}
                      {w.isPlayoffs ? " (playoff)" : ""} —{" "}
                      {new Date(w.startDate).toLocaleDateString("fr-FR")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    callAction("Ingest stats", "/test/ingest-stats", true)
                  }
                  disabled={!canRunWeekActions || busy !== null}
                  className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  data-testid="test-ingest-stats"
                >
                  {busy === "Ingest stats"
                    ? "Ingest…"
                    : "1. Ingest stats nflverse"}
                </button>
                <button
                  onClick={() =>
                    callAction("Lock lineups", "/test/lock-lineups", true)
                  }
                  disabled={!canRunWeekActions || busy !== null}
                  className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  data-testid="test-lock-lineups"
                >
                  {busy === "Lock lineups" ? "Lock…" : "2. Lock lineups"}
                </button>
                <button
                  onClick={() =>
                    callAction(
                      "Generer matchups",
                      "/test/generate-matchups",
                      true,
                    )
                  }
                  disabled={!canRunWeekActions || busy !== null}
                  className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  data-testid="test-generate-matchups"
                >
                  {busy === "Generer matchups"
                    ? "Generation…"
                    : "3. Generer matchups"}
                </button>
                <button
                  onClick={() =>
                    callAction("Settle week", "/test/settle-week", true)
                  }
                  disabled={!canRunWeekActions || busy !== null}
                  className="rounded-md border border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                  data-testid="test-settle-week"
                >
                  {busy === "Settle week" ? "Settle…" : "4. Settle week"}
                </button>
              </div>
              {!canRunWeekActions && status === "draft" && (
                <p className="mt-2 text-xs text-amber-900/60">
                  Actions semaine indisponibles : la saison n&apos;a pas
                  encore demarre.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function summarize(out: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "number" || typeof v === "boolean") {
      parts.push(`${k}=${v}`);
    } else if (typeof v === "string" && v.length < 40) {
      parts.push(`${k}=${v}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "OK";
}
