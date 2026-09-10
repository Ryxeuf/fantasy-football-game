"use client";
/**
 * Poules d'une coupe : composition, quotas de qualification et affectation
 * des équipes. Même écran que celui de la ligue
 * (`leagues/[id]/PoolsManagerPanel`) — c'est le même besoin.
 *
 * Éditable seulement tant qu'aucune ronde n'existe (`ensurePoolsEditable`
 * côté serveur) : réaffecter une équipe après coup réécrirait rétroactivement
 * un classement déjà joué. Le QUOTA, lui, reste modifiable — il ne sert qu'au
 * seeding des play-offs, qui n'a pas encore eu lieu.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

export interface CupPoolView {
  id: string;
  name: string;
  order: number;
  color: string | null;
  qualifiesForPlayoffs: number;
  participantCount: number;
}

/** Inscription, telle que l'affectation la manipule (id d'INSCRIPTION). */
export interface CupPoolParticipant {
  participantId: string;
  teamName: string;
  poolId: string | null;
}

interface Props {
  readonly cupId: string;
  readonly participants: readonly CupPoolParticipant[];
  /** Composition encore modifiable (aucune ronde générée). */
  readonly editable: boolean;
  readonly onChanged: () => void;
}

export default function CupPoolsManagerPanel({
  cupId,
  participants,
  editable,
  onChanged,
}: Props) {
  const { t } = useLanguage();
  const [pools, setPools] = useState<CupPoolView[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newQualifies, setNewQualifies] = useState(1);

  const loadPools = useCallback(async () => {
    try {
      const res = await apiRequest<{ pools: CupPoolView[] }>(
        `/cup/${cupId}/pools`,
      );
      setPools(res.pools ?? []);
    } catch {
      // Une coupe sans poule (ou une API antérieure) n'est pas une erreur
      // d'écran : on affiche le panneau vide.
      setPools([]);
    }
  }, [cupId]);

  useEffect(() => {
    void loadPools();
  }, [loadPools]);

  const initialAssign = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const p of participants) m[p.participantId] = p.poolId ?? null;
    return m;
  }, [participants]);
  const [assign, setAssign] =
    useState<Record<string, string | null>>(initialAssign);
  useEffect(() => setAssign(initialAssign), [initialAssign]);

  const dirty = participants.some(
    (p) => (assign[p.participantId] ?? null) !== (p.poolId ?? null),
  );

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        await loadPools();
        onChanged();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setBusy(false);
      }
    },
    [loadPools, onChanged],
  );

  const createPool = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    void run(async () => {
      await apiRequest(`/cup/${cupId}/pools`, {
        method: "POST",
        body: JSON.stringify({ name, qualifiesForPlayoffs: newQualifies }),
      });
      setNewName("");
      setNewQualifies(1);
    });
  }, [cupId, newName, newQualifies, run]);

  const updateQualifies = useCallback(
    (poolId: string, qualifiesForPlayoffs: number) =>
      void run(() =>
        apiRequest(`/cup/pools/${poolId}`, {
          method: "PATCH",
          body: JSON.stringify({ qualifiesForPlayoffs }),
        }),
      ),
    [cupId, run],
  );

  const deletePool = useCallback(
    (poolId: string) => {
      if (!confirm(t.cups.poolsDeleteConfirm)) return;
      void run(() =>
        apiRequest(`/cup/pools/${poolId}`, { method: "DELETE" }),
      );
    },
    [cupId, run, t.cups.poolsDeleteConfirm],
  );

  const autoAssign = useCallback(() => {
    if (pools.length === 0) {
      setError(t.cups.poolsNeedOne);
      return;
    }
    void run(() =>
      apiRequest(`/cup/${cupId}/pools/auto-assign`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
  }, [cupId, pools.length, run, t.cups.poolsNeedOne]);

  const saveAssignments = useCallback(() => {
    const assignments = participants
      .filter((p) => (assign[p.participantId] ?? null) !== (p.poolId ?? null))
      .map((p) => ({
        participantId: p.participantId,
        poolId: assign[p.participantId] ?? null,
      }));
    if (assignments.length === 0) return;
    void run(() =>
      apiRequest(`/cup/${cupId}/pools/assign`, {
        method: "POST",
        body: JSON.stringify({ assignments }),
      }),
    );
  }, [assign, cupId, participants, run]);

  return (
    <section data-testid="cup-pools-manager" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          {t.cups.poolsTitle}
        </h2>
        {!editable ? (
          <span className="text-xs text-gray-500">{t.cups.poolsReadOnly}</span>
        ) : null}
      </div>

      {error ? (
        <p
          data-testid="cup-pools-error"
          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
        >
          {error}
        </p>
      ) : null}

      {pools.length === 0 ? (
        <p className="text-sm text-gray-600">{t.cups.poolsEmpty}</p>
      ) : (
        <ul className="space-y-1.5">
          {pools.map((pool) => (
            <li
              key={pool.id}
              data-testid={`cup-pool-row-${pool.id}`}
              className="flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
            >
              <span className="font-medium text-nuffle-anthracite">
                {pool.name}
              </span>
              <span className="text-xs text-gray-500">
                {pool.participantCount} {t.cups.poolsTeamCount}
              </span>
              <label className="ml-auto flex items-center gap-1 text-xs text-gray-600">
                {t.cups.poolsQualifies}
                <input
                  type="number"
                  min={0}
                  max={128}
                  defaultValue={pool.qualifiesForPlayoffs}
                  disabled={busy}
                  data-testid={`cup-pool-qualifies-${pool.id}`}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (
                      Number.isFinite(v) &&
                      v !== pool.qualifiesForPlayoffs
                    ) {
                      updateQualifies(pool.id, v);
                    }
                  }}
                  className="w-16 rounded border border-gray-300 px-1 py-0.5 disabled:bg-gray-100"
                />
              </label>
              {editable ? (
                <button
                  type="button"
                  data-testid={`cup-pool-delete-${pool.id}`}
                  onClick={() => deletePool(pool.id)}
                  disabled={busy}
                  className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {t.cups.poolsDelete}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-gray-600">
              {t.cups.poolsName}
              <input
                type="text"
                value={newName}
                data-testid="cup-pool-name"
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.cups.poolsNamePlaceholder}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs text-gray-600">
              {t.cups.poolsQualifies}
              <input
                type="number"
                min={0}
                max={128}
                value={newQualifies}
                data-testid="cup-pool-new-qualifies"
                onChange={(e) => setNewQualifies(Number(e.target.value))}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              data-testid="cup-pool-create"
              onClick={createPool}
              disabled={busy || newName.trim().length === 0}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {t.cups.poolsAdd}
            </button>
            <button
              type="button"
              data-testid="cup-pool-auto-assign"
              onClick={autoAssign}
              disabled={busy || pools.length === 0}
              className="rounded-md border border-indigo-400 bg-white px-3 py-1.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
            >
              {t.cups.poolsAutoAssign}
            </button>
          </div>

          {participants.length > 0 && pools.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700">
                {t.cups.poolsAssignTitle}
              </div>
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {participants.map((p) => (
                  <li
                    key={p.participantId}
                    className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-white px-2 py-1 text-sm"
                  >
                    <span className="truncate">{p.teamName}</span>
                    <select
                      data-testid={`cup-pool-assign-${p.participantId}`}
                      value={assign[p.participantId] ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        setAssign((prev) => ({
                          ...prev,
                          [p.participantId]:
                            e.target.value === "" ? null : e.target.value,
                        }))
                      }
                      className="rounded border border-gray-300 px-1 py-0.5 text-xs"
                    >
                      <option value="">{t.cups.poolsUnassigned}</option>
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
                data-testid="cup-pool-save-assignments"
                onClick={saveAssignments}
                disabled={busy || !dirty}
                className="rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-white hover:bg-nuffle-gold/90 disabled:opacity-50"
              >
                {t.cups.poolsSaveAssignments}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
