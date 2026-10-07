"use client";

/**
 * Lot 4 « évolution persistée » — panneau admin du coach IA d'une ProTeam.
 *
 * Montre le profil VIVANT (qui évolue entre deux matchs) à côté de l'ANCRE
 * (la base autour de laquelle il bouge, ± 15 points). L'admin règle
 * l'ancre : un PATCH n'envoie que les paramètres modifiés, le serveur y
 * ramène le profil vivant. « Réinitialiser » revient au profil de race.
 * Le journal liste les dernières évolutions avec leurs raisons.
 */

import { useCallback, useEffect, useState } from "react";

import { API_BASE } from "../../../../../auth-client";

import { COACH_PARAMETERS, diffProfiles, type CoachProfile } from "./coach-parameters";

interface CoachView {
  readonly id: string;
  readonly name: string;
  readonly philosophy: string;
  readonly profile: CoachProfile;
  readonly anchorProfile: CoachProfile;
  readonly experience: number;
  readonly updatedAt: string;
}

interface MemoryChange {
  readonly parameter: string;
  readonly before: number;
  readonly after: number;
  readonly reason: string;
}

interface MemoryEntry {
  readonly id: string;
  readonly matchId: string | null;
  readonly summary: string;
  readonly changes: readonly MemoryChange[];
  readonly createdAt: string;
}

interface CoachPanelProps {
  readonly teamId: string;
}

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string })?.error || `Erreur ${res.status}`);
  }
  return json as T;
}

export default function CoachPanel({ teamId }: CoachPanelProps) {
  const [coach, setCoach] = useState<CoachView | null>(null);
  const [memory, setMemory] = useState<readonly MemoryEntry[]>([]);
  const [anchor, setAnchor] = useState<CoachProfile>({});
  const [name, setName] = useState("");
  const [philosophy, setPhilosophy] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, m] = await Promise.all([
        fetchJSON<{ coach: CoachView }>(`/admin/pro-league/teams/${teamId}/coach`),
        fetchJSON<{ memory: readonly MemoryEntry[] }>(
          `/admin/pro-league/teams/${teamId}/coach/memory?limit=10`,
        ).catch(() => ({ memory: [] as readonly MemoryEntry[] })),
      ]);
      setCoach(c.coach);
      setAnchor(c.coach.anchorProfile);
      setName(c.coach.name);
      setPhilosophy(c.coach.philosophy);
      setMemory(m.memory);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement du coach");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const profileDiff = coach ? diffProfiles(coach.anchorProfile, anchor) : {};
  const dirty =
    Object.keys(profileDiff).length > 0 ||
    (coach !== null && (name !== coach.name || philosophy !== coach.philosophy));

  const handleSave = useCallback(async () => {
    if (!coach) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = {};
      if (name !== coach.name) body.name = name;
      if (philosophy !== coach.philosophy) body.philosophy = philosophy;
      if (Object.keys(profileDiff).length > 0) body.profile = profileDiff;
      const data = await fetchJSON<{ coach: CoachView }>(
        `/admin/pro-league/teams/${teamId}/coach`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      setCoach(data.coach);
      setAnchor(data.coach.anchorProfile);
      setName(data.coach.name);
      setPhilosophy(data.coach.philosophy);
      setSuccess("Ancre du coach enregistrée.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }, [coach, name, philosophy, profileDiff, teamId]);

  const handleReset = useCallback(async () => {
    if (!window.confirm("Réinitialiser le coach au profil de race ? Sa mémoire sera vidée.")) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJSON(`/admin/pro-league/teams/${teamId}/coach/reset`, { method: "POST" });
      await load();
      setSuccess("Coach réinitialisé.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la réinitialisation");
    } finally {
      setSaving(false);
    }
  }, [load, teamId]);

  if (loading) {
    return (
      <div className="p-4 rounded-xl border bg-white border-gray-200" data-testid="coach-panel">
        <p className="text-sm text-gray-500">Chargement du coach…</p>
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="p-4 rounded-xl border bg-white border-gray-200" data-testid="coach-panel">
        <h2 className="text-lg font-semibold mb-2">Coach IA</h2>
        <p className="text-sm text-red-600" data-testid="coach-error">
          {error ?? "Coach indisponible"}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border bg-white border-gray-200 space-y-4" data-testid="coach-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Coach IA</h2>
          <p className="text-xs text-gray-500">
            Expérience : <span data-testid="coach-experience">{coach.experience}</span> match
            {coach.experience > 1 ? "s" : ""} intégré{coach.experience > 1 ? "s" : ""}. Le profil
            vivant évolue de lui-même dans une bande de ± 15 autour de l&apos;ancre que vous
            réglez ici.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="px-3 py-1 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          data-testid="coach-reset"
        >
          Réinitialiser (profil de race)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Nom du coach</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
            data-testid="coach-name"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Philosophie</span>
          <input
            type="text"
            value={philosophy}
            onChange={(e) => setPhilosophy(e.target.value)}
            maxLength={120}
            className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
            data-testid="coach-philosophy"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[11px] uppercase text-gray-500">
          <span>Paramètre (ancre)</span>
          <span className="w-10 text-right">Ancre</span>
          <span className="w-10 text-right">Vivant</span>
        </div>
        {COACH_PARAMETERS.map((p) => {
          const anchorValue = anchor[p.key] ?? 50;
          const living = coach.profile[p.key] ?? 50;
          const drift = living - (coach.anchorProfile[p.key] ?? 50);
          return (
            <div key={p.key} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
              <label className="block">
                <span className="text-xs font-semibold text-gray-700">{p.label}</span>
                <span className="ml-2 text-[10px] text-gray-400">
                  {p.low} ↔ {p.high}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={anchorValue}
                  onChange={(e) => setAnchor({ ...anchor, [p.key]: Number(e.target.value) })}
                  className="mt-1 w-full"
                  aria-label={p.label}
                  data-testid={`coach-anchor-${p.key}`}
                />
              </label>
              <span className="w-10 text-right font-mono text-sm">{anchorValue}</span>
              <span
                className={`w-10 text-right font-mono text-sm ${drift > 0 ? "text-emerald-700" : drift < 0 ? "text-rose-700" : "text-gray-500"}`}
                title={drift === 0 ? "Sur l'ancre" : `${drift > 0 ? "+" : ""}${drift} par rapport à l'ancre`}
                data-testid={`coach-living-${p.key}`}
              >
                {living}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded bg-gray-900 text-white text-sm disabled:opacity-50"
          data-testid="coach-save"
        >
          {saving ? "Enregistrement…" : "Enregistrer l'ancre"}
        </button>
        <span className="text-xs text-gray-500" data-testid="coach-dirty">
          {dirty ? "Modifications non enregistrées" : "Aucune modification"}
        </span>
        {success && <span className="text-xs text-emerald-700">{success}</span>}
        {error && (
          <span className="text-xs text-red-600" data-testid="coach-error">
            {error}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Journal des évolutions</h3>
        {memory.length === 0 ? (
          <p className="text-xs text-gray-500" data-testid="coach-memory-empty">
            Aucune évolution : le coach n&apos;a pas encore intégré de match.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="coach-memory">
            {memory.map((m) => (
              <li key={m.id} className="rounded border border-gray-200 bg-gray-50 p-2 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>{new Date(m.createdAt).toLocaleString()}</span>
                  {m.matchId ? <code className="text-gray-400">{m.matchId}</code> : <span>admin</span>}
                </div>
                <p className="text-gray-800">{m.summary}</p>
                {m.changes.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-gray-600">
                    {m.changes
                      .filter((c) => !c.reason.startsWith("rappel"))
                      .map((c) => (
                        <li key={`${m.id}-${c.parameter}`}>{c.reason}</li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
