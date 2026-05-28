"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../lib/api-client";

interface MeResponse {
  user: { id: string } | null;
}

interface LeagueEntry {
  id: string;
  userId: string;
  teamName: string;
}

interface LeagueDetail {
  id: string;
  name: string;
  entries: LeagueEntry[];
}

interface CareerRow {
  id: string;
  entryId: string;
  playerId: string;
  sppCareer: number;
  sppSpent: number;
  sppAvailable: number;
  skillsUnlocked: string[];
}

interface CareersResponse {
  careers: CareerRow[];
}

interface PlayerLite {
  id: string;
  pseudonym: string;
  bbPosition: string;
  teamCode: string | null;
}

export default function LeagueCareerListPage() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [entryId, setEntryId] = useState<string | null>(null);
  const [notMember, setNotMember] = useState(false);
  const [careers, setCareers] = useState<CareerRow[] | null>(null);
  const [playersById, setPlayersById] = useState<Record<string, PlayerLite>>({});
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    async function load() {
      try {
        const [me, league] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<LeagueDetail>(`/api/nfl-fantasy/leagues/${leagueId}`),
        ]);
        const userId = me.user?.id ?? null;
        if (!userId) {
          if (!cancelled) setError({ message: "Non authentifie", status: 401 });
          return;
        }
        const mine = league.entries.find((e) => e.userId === userId);
        if (!mine) {
          if (!cancelled) setNotMember(true);
          return;
        }
        if (cancelled) return;
        setEntryId(mine.id);

        const { careers } = await apiRequest<CareersResponse>(
          `/api/nfl-fantasy/entries/${mine.id}/careers`,
        );
        if (cancelled) return;
        setCareers(careers);

        const players = await Promise.all(
          careers.map((c) =>
            apiRequest<PlayerLite>(`/api/nfl-fantasy/players/${c.playerId}`).catch(
              () => null,
            ),
          ),
        );
        if (cancelled) return;
        const map: Record<string, PlayerLite> = {};
        for (const p of players) {
          if (p) map[p.id] = p;
        }
        setPlayersById(map);
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
  }, [leagueId]);

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

  if (notMember) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Pas membre de ce championnat</h1>
        <Link
          href={`/nfl-fantasy/leagues/${leagueId}`}
          className="mt-4 inline-block text-sm text-nuffle-gold hover:text-nuffle-gold"
        >
          ← Retour au championnat
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="career-list">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${leagueId}`}
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← Retour au championnat
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Carrière de mes joueurs</h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          Chaque joueur accumule des SPP au fil des semaines. Dépense ces SPP
          pour débloquer des compétences Blood Bowl supplémentaires —{" "}
          <strong>6 SPP en primaire, 12 en secondaire</strong>. Le pool d'accès
          est fixé par la position Blood Bowl du joueur et la race de son équipe
          NFL.
        </p>
      </div>

      {error && error.status !== 401 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Erreur : {error.message}
        </div>
      )}

      {careers === null && !error && !notMember && (
        <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>
      )}

      {careers !== null && careers.length === 0 && (
        <div className="rounded-lg border border-dashed border-nuffle-bronze/20 bg-white p-10 text-center text-sm text-nuffle-anthracite/70">
          Aucune carrière encore — joue quelques semaines pour accumuler des SPP.
        </div>
      )}

      {careers !== null && careers.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-nuffle-bronze/20 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-nuffle-cream/40 text-left text-xs uppercase tracking-wide text-nuffle-anthracite/60">
              <tr>
                <th className="px-4 py-2">Joueur</th>
                <th className="px-4 py-2">Position</th>
                <th className="px-4 py-2 text-right">SPP cumulés</th>
                <th className="px-4 py-2 text-right">SPP disponibles</th>
                <th className="px-4 py-2">Skills débloquées</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {careers.map((c) => {
                const p = playersById[c.playerId];
                return (
                  <tr key={c.id} className="border-t border-nuffle-bronze/10">
                    <td className="px-4 py-3 font-medium">
                      {p?.pseudonym ?? c.playerId}
                    </td>
                    <td className="px-4 py-3 text-nuffle-anthracite/70">
                      {p?.bbPosition ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.sppCareer}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-nuffle-bronze">
                      {c.sppAvailable}
                    </td>
                    <td className="px-4 py-3">
                      {c.skillsUnlocked.length === 0 ? (
                        <span className="text-xs text-nuffle-anthracite/40">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {c.skillsUnlocked.map((s) => (
                            <span
                              key={s}
                              className="rounded bg-nuffle-cream px-1.5 py-0.5 text-xs"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/nfl-fantasy/leagues/${leagueId}/career/${c.playerId}`}
                        className="text-xs text-nuffle-gold hover:underline"
                      >
                        Détails →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
