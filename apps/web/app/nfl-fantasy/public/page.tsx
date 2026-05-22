"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { apiRequest, ApiClientError } from "../../lib/api-client";
import type { LeagueStatus, LeagueType } from "../types";

interface PublicLeagueCycle {
  readonly id: string;
  readonly label: string;
  readonly startWeek: number;
  readonly endWeek: number;
  readonly cycleType: "regular" | "playoffs";
}

interface PublicLeague {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly size: number;
  readonly type: LeagueType;
  readonly status: LeagueStatus;
  readonly seasonId: string;
  readonly draftMode: string;
  readonly draftBudget: number;
  readonly createdAt: string;
  readonly entriesCount: number;
  readonly isJoinable: boolean;
  readonly cycle?: PublicLeagueCycle | null;
}

interface ListResponse {
  readonly leagues: PublicLeague[];
}

export default function PublicChampionnatsPage() {
  const router = useRouter();
  const [data, setData] = useState<PublicLeague[] | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );

  // Modal join
  const [joining, setJoining] = useState<PublicLeague | null>(null);
  const [teamName, setTeamName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const out = await apiRequest<ListResponse>(
          "/api/nfl-fantasy/leagues/public",
        );
        if (!cancelled) setData(out.leagues);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError) {
          setError({ message: err.message, status: err.status });
        } else {
          setError({
            message: err instanceof Error ? err.message : "Erreur inconnue",
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitJoin(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!joining) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiRequest(`/api/nfl-fantasy/leagues/${joining.id}/join`, {
        method: "POST",
        body: JSON.stringify({ teamName: teamName.trim() }),
      });
      router.push(`/nfl-fantasy/leagues/${joining.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSubmitError(err.message);
      } else {
        setSubmitError(err instanceof Error ? err.message : "Erreur");
      }
      setSubmitting(false);
    }
  }

  if (error?.status === 401) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="nuffle-coach-public">
      <div>
        <Link
          href="/nfl-fantasy"
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← Mes championnats
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          Championnats publics ouverts
        </h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          Rejoins un championnat ouvert créé par un autre coach. Les
          championnats privés nécessitent un invite code via la page{" "}
          <Link
            href="/nfl-fantasy/join"
            className="underline hover:text-nuffle-gold"
          >
            Rejoindre
          </Link>
          .
        </p>
      </div>

      {error && error.status !== 401 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {data === null && !error && (
        <p className="text-sm text-nuffle-anthracite/70">Chargement…</p>
      )}

      {data !== null && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-nuffle-bronze/30 bg-white p-10 text-center">
          <p className="text-base text-nuffle-anthracite/80">
            Aucun championnat public ouvert pour le moment.
          </p>
          <p className="mt-1 text-sm text-nuffle-anthracite/60">
            Sois le premier !{" "}
            <Link
              href="/nfl-fantasy/new"
              className="text-nuffle-gold hover:text-nuffle-red"
            >
              Créer un championnat public
            </Link>
          </p>
        </div>
      )}

      {data !== null && data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((lg) => (
            <li
              key={lg.id}
              className="rounded-lg border border-nuffle-bronze/20 bg-white p-4"
            >
              <h2 className="text-lg font-semibold text-nuffle-anthracite">
                {lg.name}
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-nuffle-anthracite/70">
                <div>
                  <dt className="text-nuffle-anthracite/60">Coachs</dt>
                  <dd>
                    {lg.entriesCount} / {lg.size}
                  </dd>
                </div>
                <div>
                  <dt className="text-nuffle-anthracite/60">Mini-saison</dt>
                  <dd>
                    {lg.cycle ? (
                      <>
                        {lg.cycle.label}{" "}
                        <span className="text-nuffle-anthracite/50">
                          (W{lg.cycle.startWeek}-W{lg.cycle.endWeek})
                        </span>
                      </>
                    ) : (
                      lg.seasonId
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-nuffle-anthracite/60">Budget TV</dt>
                  <dd>{lg.draftBudget}</dd>
                </div>
                <div>
                  <dt className="text-nuffle-anthracite/60">Créé le</dt>
                  <dd>{new Date(lg.createdAt).toLocaleDateString("fr-FR")}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={`/nfl-fantasy/leagues/${lg.id}`}
                  className="text-xs text-nuffle-anthracite/70 hover:text-nuffle-gold"
                >
                  Voir détails
                </Link>
                {lg.isJoinable ? (
                  <button
                    onClick={() => {
                      setJoining(lg);
                      setTeamName("");
                      setSubmitError(null);
                    }}
                    className="rounded-md bg-nuffle-gold px-3 py-1.5 text-xs font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80"
                  >
                    Rejoindre
                  </button>
                ) : (
                  <span className="text-xs text-nuffle-anthracite/60">
                    {lg.entriesCount >= lg.size ? "Complet" : "Déjà membre"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {joining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={submitJoin}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-nuffle-anthracite">
              Rejoindre &ldquo;{joining.name}&rdquo;
            </h3>
            <p className="mt-1 text-sm text-nuffle-anthracite/70">
              {joining.entriesCount}/{joining.size} coachs · Saison{" "}
              {joining.seasonId}
            </p>
            <div className="mt-4">
              <label
                htmlFor="teamName"
                className="text-sm font-medium text-nuffle-anthracite"
              >
                Nom de ton équipe
              </label>
              <input
                id="teamName"
                type="text"
                required
                minLength={3}
                maxLength={50}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="mt-1 w-full rounded-md border border-nuffle-bronze/30 bg-white px-3 py-2 text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
                placeholder="Les Rats Saucissons"
                autoFocus
              />
            </div>
            {submitError && (
              <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                {submitError}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setJoining(null)}
                className="rounded-md border border-nuffle-bronze/30 px-3 py-1.5 text-sm text-nuffle-anthracite hover:border-nuffle-bronze"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || teamName.trim().length < 3}
                className="rounded-md bg-nuffle-gold px-4 py-1.5 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80 disabled:opacity-50"
              >
                {submitting ? "Connexion…" : "Rejoindre"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
