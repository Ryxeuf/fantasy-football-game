"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../lib/api-client";
import type {
  LeagueWithEntries,
  NflFantasyLeague,
  NflFantasyEntry,
} from "../../types";

function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft en cours";
    case "in_progress":
      return "En saison";
    case "completed":
      return "Terminée";
    default:
      return status;
  }
}

interface MeResponse {
  user?: { id: string } | null;
}

export default function LeagueDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [league, setLeague] = useState<LeagueWithEntries | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leagueId) return;
    try {
      const [lg, me] = await Promise.all([
        apiRequest<LeagueWithEntries>(`/api/nfl-fantasy/leagues/${leagueId}`),
        apiRequest<MeResponse>("/auth/me").catch(() => ({ user: null }) as MeResponse),
      ]);
      setLeague(lg);
      setCurrentUserId(me.user?.id ?? null);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError({ message: err.message, status: err.status });
      } else {
        setError({ message: err instanceof Error ? err.message : "Erreur" });
      }
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyInvite(): Promise<void> {
    if (!league?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(league.inviteCode);
      setBusy("copied");
      setTimeout(() => setBusy(null), 1500);
    } catch {
      // pas de feedback (clipboard interdit, on ignore)
    }
  }

  async function rename(): Promise<void> {
    if (!league) return;
    const next = window.prompt("Nouveau nom (3-50 caractères) :", league.name);
    if (!next || next.trim() === league.name) return;
    setActionError(null);
    setBusy("rename");
    try {
      const updated = await apiRequest<NflFantasyLeague>(
        `/api/nfl-fantasy/leagues/${league.id}`,
        { method: "PATCH", body: JSON.stringify({ name: next.trim() }) },
      );
      setLeague({ ...league, ...updated });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  async function togglePrivacy(): Promise<void> {
    if (!league) return;
    const newType = league.type === "private" ? "public" : "private";
    setActionError(null);
    setBusy("privacy");
    try {
      const updated = await apiRequest<NflFantasyLeague>(
        `/api/nfl-fantasy/leagues/${league.id}`,
        { method: "PATCH", body: JSON.stringify({ type: newType }) },
      );
      setLeague({ ...league, ...updated });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  async function leave(): Promise<void> {
    if (!league) return;
    if (!window.confirm("Quitter cette league ?")) return;
    setActionError(null);
    setBusy("leave");
    try {
      await apiRequest<void>(`/api/nfl-fantasy/leagues/${league.id}/leave`, {
        method: "POST",
      });
      router.push("/nfl-fantasy");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
      setBusy(null);
    }
  }

  async function remove(): Promise<void> {
    if (!league) return;
    if (
      !window.confirm(
        `Supprimer la league "${league.name}" ? Action irréversible.`,
      )
    )
      return;
    setActionError(null);
    setBusy("delete");
    try {
      await apiRequest<void>(`/api/nfl-fantasy/leagues/${league.id}`, {
        method: "DELETE",
      });
      router.push("/nfl-fantasy");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
      setBusy(null);
    }
  }

  if (error?.status === 401) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-400"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (error?.status === 404 || error?.status === 403) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">League introuvable</h1>
        <p className="mt-2 text-sm text-slate-400">{error.message}</p>
        <Link href="/nfl-fantasy" className="mt-4 inline-block text-sm text-orange-400 hover:text-orange-300">
          ← Retour à mes leagues
        </Link>
      </div>
    );
  }

  if (!league) {
    return <div className="text-sm text-slate-400">Chargement…</div>;
  }

  const isOwner = currentUserId !== null && currentUserId === league.ownerId;
  const isMember =
    currentUserId !== null && league.entries.some((e) => e.userId === currentUserId);
  const isDraft = league.status === "draft";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/nfl-fantasy" className="text-sm text-slate-400 hover:text-white">
          ← Mes leagues
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="nfl-fantasy-league-name">
              {league.name}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Saison {league.seasonId} · {league.entries.length}/{league.size} membres ·{" "}
              <span className="capitalize">{league.draftMode}</span>
            </p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-200">
            {statusLabel(league.status)}
          </span>
        </div>
      </div>

      {league.inviteCode && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
          <p className="text-xs uppercase tracking-wide text-orange-300/80">Invite code</p>
          <div className="mt-1 flex items-center gap-3">
            <code
              className="font-mono text-2xl tracking-widest text-white"
              data-testid="nfl-fantasy-invite-code"
            >
              {league.inviteCode}
            </code>
            <button
              onClick={copyInvite}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
            >
              {busy === "copied" ? "Copié ✓" : "Copier"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Partage ce code via la page <Link href="/nfl-fantasy/join" className="underline">rejoindre</Link>.
          </p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-200">Membres</h2>
        <ul
          className="mt-3 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900/40"
          data-testid="nfl-fantasy-entries"
        >
          {league.entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-slate-100">{entry.teamName}</p>
                <p className="text-xs text-slate-500">
                  Rejoint le {new Date(entry.joinedAt).toLocaleDateString("fr-FR")}
                  {entry.userId === league.ownerId && (
                    <span className="ml-2 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] uppercase text-orange-300">
                      Owner
                    </span>
                  )}
                  {entry.userId === currentUserId && entry.userId !== league.ownerId && (
                    <span className="ml-2 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase text-slate-200">
                      Toi
                    </span>
                  )}
                </p>
              </div>
              <span className="text-xs text-slate-500">TV {entry.totalTV}</span>
            </li>
          ))}
        </ul>
      </section>

      {isMember && league.status === "in_progress" && (
        <section>
          <h2 className="text-lg font-semibold text-slate-200">Ma semaine</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/nfl-fantasy/leagues/${league.id}/lineup`}
              className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
              data-testid="nfl-fantasy-lineup-cta"
            >
              🐀 Régler mon lineup
            </Link>
            <Link
              href={`/nfl-fantasy/leagues/${league.id}/matchups`}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
              data-testid="nfl-fantasy-matchups-cta"
            >
              📊 Matchups &amp; standings
            </Link>
          </div>
        </section>
      )}

      {!isMember && league.status === "in_progress" && (
        <Link
          href={`/nfl-fantasy/leagues/${league.id}/matchups`}
          className="inline-block text-sm text-orange-400 hover:text-orange-300"
        >
          📊 Voir matchups &amp; standings
        </Link>
      )}

      {(isOwner || isMember) && (
        <section>
          <h2 className="text-lg font-semibold text-slate-200">Actions</h2>
          {actionError && (
            <div className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {actionError}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {isOwner && isDraft && (
              <>
                <button
                  onClick={rename}
                  disabled={busy === "rename"}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500 disabled:opacity-50"
                >
                  Renommer
                </button>
                <button
                  onClick={togglePrivacy}
                  disabled={busy === "privacy"}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500 disabled:opacity-50"
                >
                  {league.type === "private"
                    ? "Rendre publique"
                    : "Rendre privée"}
                </button>
                <button
                  onClick={remove}
                  disabled={busy === "delete"}
                  className="rounded-md border border-red-700/60 bg-red-900/30 px-3 py-1.5 text-sm text-red-200 hover:border-red-500 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </>
            )}
            {!isOwner && isMember && isDraft && (
              <button
                onClick={leave}
                disabled={busy === "leave"}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500 disabled:opacity-50"
              >
                Quitter la league
              </button>
            )}
            {!isDraft && (
              <p className="text-sm text-slate-500">
                La saison est démarrée — les actions de configuration sont verrouillées.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
