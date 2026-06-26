"use client";
import { useCallback, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import type { LeaguePool, LeagueParticipantDetail } from "./types";

// FR2 — gestion des poules (groupes) d'une saison + affectation des
// équipes et nombre de qualifiés par poule pour les play-offs. Réservé au
// commissaire et éditable seulement avant le démarrage de la saison
// (draft / scheduled), conformément à `ensureSeasonEditable` côté serveur.

interface PoolsManagerPanelProps {
  seasonId: string;
  pools: LeaguePool[];
  participants: LeagueParticipantDetail[];
  /** Saison encore éditable (draft / scheduled). */
  editable: boolean;
  onChanged: () => void;
}

export function PoolsManagerPanel({
  seasonId,
  pools,
  participants,
  editable,
  onChanged,
}: PoolsManagerPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newQualifies, setNewQualifies] = useState<number>(1);

  // Affectation locale (participantId -> poolId|null), initialisée depuis les
  // données serveur ; "dirty" tant qu'elle diverge.
  const initialAssign = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const p of participants) m[p.id] = p.poolId ?? null;
    return m;
  }, [participants]);
  const [assign, setAssign] = useState<Record<string, string | null>>(initialAssign);

  const dirty = useMemo(
    () => participants.some((p) => (assign[p.id] ?? null) !== (p.poolId ?? null)),
    [assign, participants],
  );

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        onChanged();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const createPool = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      await apiRequest(`/leagues/seasons/${seasonId}/pools`, {
        method: "POST",
        body: JSON.stringify({ name, qualifiesForPlayoffs: newQualifies }),
      });
      setNewName("");
      setNewQualifies(1);
    });
  }, [newName, newQualifies, run, seasonId]);

  const updatePool = useCallback(
    (poolId: string, patch: Partial<Pick<LeaguePool, "name" | "qualifiesForPlayoffs">>) =>
      run(() =>
        apiRequest(`/leagues/pools/${poolId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      ),
    [run],
  );

  const deletePool = useCallback(
    (poolId: string) => {
      if (!confirm("Supprimer cette poule ? Les équipes seront désaffectées.")) return;
      run(() => apiRequest(`/leagues/pools/${poolId}`, { method: "DELETE" }));
    },
    [run],
  );

  const autoAssign = useCallback(() => {
    if (pools.length === 0) {
      setError("Créez d'abord au moins une poule.");
      return;
    }
    run(() =>
      apiRequest(`/leagues/seasons/${seasonId}/pools/auto-assign`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
  }, [pools.length, run, seasonId]);

  const saveAssignments = useCallback(() => {
    const assignments = participants
      .filter((p) => (assign[p.id] ?? null) !== (p.poolId ?? null))
      .map((p) => ({ participantId: p.id, poolId: assign[p.id] ?? null }));
    if (assignments.length === 0) return;
    run(() =>
      apiRequest(`/leagues/seasons/${seasonId}/pools/assign`, {
        method: "POST",
        body: JSON.stringify({ assignments }),
      }),
    );
  }, [assign, participants, run, seasonId]);

  return (
    <section
      data-testid="pools-manager"
      className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-900">
          Poules
        </h3>
        {!editable ? (
          <span className="text-xs text-gray-500">
            Lecture seule (saison démarrée)
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      ) : null}

      {/* Liste des poules */}
      {pools.length === 0 ? (
        <p className="text-xs text-gray-600">
          Aucune poule. Créez-en pour répartir les équipes et définir les
          qualifiés en play-offs.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {pools.map((pool) => (
            <li
              key={pool.id}
              data-testid={`pool-row-${pool.id}`}
              className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1.5 text-sm"
            >
              <span className="font-medium text-nuffle-anthracite">{pool.name}</span>
              <span className="text-xs text-gray-500">
                {pool._count?.participants ?? 0} équipe(s)
              </span>
              <label className="ml-auto flex items-center gap-1 text-xs text-gray-600">
                Qualifiés PO :
                <input
                  type="number"
                  min={0}
                  max={128}
                  defaultValue={pool.qualifiesForPlayoffs}
                  disabled={!editable || busy}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v !== pool.qualifiesForPlayoffs) {
                      updatePool(pool.id, { qualifiesForPlayoffs: v });
                    }
                  }}
                  className="w-16 border border-gray-300 rounded px-1 py-0.5 disabled:bg-gray-100"
                />
              </label>
              {editable ? (
                <button
                  type="button"
                  data-testid={`pool-delete-${pool.id}`}
                  onClick={() => deletePool(pool.id)}
                  disabled={busy}
                  className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Supprimer
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <>
          {/* Création de poule */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-gray-600">
              Nom de la poule
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Poule A"
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs text-gray-600">
              Qualifiés PO
              <input
                type="number"
                min={0}
                max={128}
                value={newQualifies}
                onChange={(e) => setNewQualifies(Number(e.target.value))}
                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              data-testid="pool-create"
              onClick={createPool}
              disabled={busy || newName.trim().length === 0}
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              + Ajouter
            </button>
            <button
              type="button"
              data-testid="pool-auto-assign"
              onClick={autoAssign}
              disabled={busy || pools.length === 0}
              className="px-3 py-1.5 rounded-md bg-white border border-indigo-400 text-indigo-800 text-sm font-medium hover:bg-indigo-100 disabled:opacity-50"
            >
              Répartir automatiquement
            </button>
          </div>

          {/* Affectation manuelle des équipes */}
          {participants.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700">
                Affectation des équipes
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {participants.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded px-2 py-1 text-sm"
                  >
                    <span className="truncate">{p.team.name}</span>
                    <select
                      data-testid={`pool-assign-${p.id}`}
                      value={assign[p.id] ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        setAssign((prev) => ({
                          ...prev,
                          [p.id]: e.target.value === "" ? null : e.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                    >
                      <option value="">— Non affecté —</option>
                      {pools.map((pool) => (
                        <option key={pool.id} value={pool.id}>
                          {pool.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                data-testid="pool-save-assignments"
                onClick={saveAssignments}
                disabled={busy || !dirty}
                className="px-3 py-1.5 rounded-md bg-nuffle-gold text-white text-sm font-medium hover:bg-nuffle-gold/90 disabled:opacity-50"
              >
                Enregistrer l'affectation
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
