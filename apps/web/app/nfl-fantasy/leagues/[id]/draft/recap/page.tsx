"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../../lib/api-client";

interface SessionRow {
  id: string;
  sessionNumber: number;
  opensAt: string;
  closesAt: string;
  resolvedAt: string | null;
  status: "open" | "closed" | "resolved";
}

interface SessionsResponse {
  sessions: SessionRow[];
}

interface LosingBid {
  entryId: string;
  teamName: string;
  amount: number;
}

interface Outcome {
  playerId: string;
  playerPseudonym: string | null;
  playerBbPosition: string | null;
  playerTeamCode: string | null;
  winnerEntryId: string | null;
  winnerTeamName: string | null;
  winnerAmount: number | null;
  losingBids: LosingBid[];
}

interface SessionDetailResolved {
  session: SessionRow;
  outcomes: Outcome[];
}

interface SessionDetailOpen {
  session: SessionRow;
  bidCount: number;
}

type SessionDetail = SessionDetailResolved | SessionDetailOpen;

function isResolvedDetail(d: SessionDetail): d is SessionDetailResolved {
  return d.session.status === "resolved";
}

export default function DraftRecapPage() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [details, setDetails] = useState<Record<string, SessionDetail>>({});
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    async function load() {
      try {
        const out = await apiRequest<SessionsResponse>(
          `/api/nfl-fantasy/draft-sessions/leagues/${leagueId}`,
        );
        if (cancelled) return;
        setSessions(out.sessions);
        // Fetch detail des sessions résolues en parallèle.
        const resolved = out.sessions.filter((s) => s.status === "resolved");
        const detailMap: Record<string, SessionDetail> = {};
        await Promise.all(
          resolved.map(async (s) => {
            try {
              const d = await apiRequest<SessionDetail>(
                `/api/nfl-fantasy/draft-sessions/${s.id}`,
              );
              detailMap[s.id] = d;
            } catch {
              // Ignore une session non chargee.
            }
          }),
        );
        if (cancelled) return;
        setDetails(detailMap);
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

  return (
    <div className="space-y-6" data-testid="draft-recap">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${leagueId}/draft`}
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← Retour au Mercato
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Récap des sessions de draft</h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          Historique des résolutions. Pour chaque session résolue : qui a
          gagné quel joueur, à combien, et les autres enchères perdantes.
        </p>
      </div>

      {error && error.status !== 401 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Erreur : {error.message}
        </div>
      )}

      {sessions === null && !error && (
        <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>
      )}

      {sessions !== null && sessions.length === 0 && (
        <div className="rounded-lg border border-dashed border-nuffle-bronze/20 bg-white p-10 text-center text-sm text-nuffle-anthracite/70">
          Aucune session encore — démarre une session depuis la page Mercato.
        </div>
      )}

      {sessions !== null &&
        sessions.map((s) => {
          const detail = details[s.id];
          return (
            <SessionRecapCard
              key={s.id}
              session={s}
              detail={detail && isResolvedDetail(detail) ? detail : null}
            />
          );
        })}
    </div>
  );
}

function SessionRecapCard({
  session,
  detail,
}: {
  session: SessionRow;
  detail: SessionDetailResolved | null;
}) {
  const openedAt = new Date(session.opensAt).toLocaleString("fr-FR");
  const closedAt = new Date(session.closesAt).toLocaleString("fr-FR");
  const resolvedAt = session.resolvedAt
    ? new Date(session.resolvedAt).toLocaleString("fr-FR")
    : null;

  return (
    <section
      className="rounded-lg border border-nuffle-bronze/20 bg-white"
      data-testid={`session-recap-${session.id}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-nuffle-bronze/10 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-nuffle-anthracite">
            Session #{session.sessionNumber}
          </h2>
          <p className="text-xs text-nuffle-anthracite/60">
            Ouverte le {openedAt} · Fermée le {closedAt}
            {resolvedAt ? ` · Résolue le ${resolvedAt}` : ""}
          </p>
        </div>
        <StatusBadge status={session.status} />
      </header>

      {session.status !== "resolved" && (
        <div className="px-4 py-6 text-sm text-nuffle-anthracite/60">
          Session non encore résolue. Le récap apparaîtra après résolution.
        </div>
      )}

      {session.status === "resolved" && !detail && (
        <div className="px-4 py-6 text-sm text-nuffle-anthracite/60">
          Chargement du récap…
        </div>
      )}

      {session.status === "resolved" && detail && detail.outcomes.length === 0 && (
        <div className="px-4 py-6 text-sm text-nuffle-anthracite/60">
          Aucune enchère sur cette session — rien à attribuer.
        </div>
      )}

      {session.status === "resolved" && detail && detail.outcomes.length > 0 && (
        <table className="w-full text-sm">
          <thead className="bg-nuffle-cream/40 text-left text-xs uppercase tracking-wide text-nuffle-anthracite/60">
            <tr>
              <th className="px-4 py-2">Joueur</th>
              <th className="px-4 py-2">Vainqueur</th>
              <th className="px-4 py-2 text-right">Prix</th>
              <th className="px-4 py-2">Concurrents</th>
            </tr>
          </thead>
          <tbody>
            {detail.outcomes.map((o) => (
              <tr
                key={o.playerId}
                className="border-t border-nuffle-bronze/10 align-top"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {o.playerPseudonym ?? o.playerId}
                  </div>
                  <div className="text-xs text-nuffle-anthracite/60">
                    {o.playerBbPosition ?? "—"} · {o.playerTeamCode ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {o.winnerTeamName ? (
                    <span className="font-medium text-nuffle-bronze">
                      {o.winnerTeamName}
                    </span>
                  ) : (
                    <span className="text-xs text-nuffle-anthracite/40">
                      Non attribué
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {o.winnerAmount !== null ? `${o.winnerAmount} TV` : "—"}
                </td>
                <td className="px-4 py-3">
                  {o.losingBids.length === 0 ? (
                    <span className="text-xs text-nuffle-anthracite/40">—</span>
                  ) : (
                    <ul className="text-xs text-nuffle-anthracite/70">
                      {o.losingBids.map((lb) => (
                        <li key={lb.entryId}>
                          {lb.teamName} ·{" "}
                          <span className="font-mono">{lb.amount} TV</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: "Ouverte", cls: "bg-emerald-100 text-emerald-800" },
    closed: { label: "Fermée", cls: "bg-amber-100 text-amber-800" },
    resolved: { label: "Résolue", cls: "bg-nuffle-cream text-nuffle-bronze" },
  };
  const info = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}
