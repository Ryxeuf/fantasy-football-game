"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../lib/api-client";
import { useFeatureFlag } from "../../../hooks/useFeatureFlag";
import { NUFFLE_COACH_TEST_FLAG } from "../../../lib/featureFlagKeys";
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
  const testMode = useFeatureFlag(NUFFLE_COACH_TEST_FLAG);

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

  async function populateTestCoaches(): Promise<void> {
    if (!league) return;
    const slots = league.size - league.entries.length;
    if (slots <= 0) {
      setActionError("Le championnat est déjà plein.");
      return;
    }
    if (
      !window.confirm(
        `Remplir avec ${slots} coachs de test ? Pioche dans les comptes existants en base et leur attribue des noms d'équipe BB-flavor.`,
      )
    )
      return;
    setActionError(null);
    setBusy("populate");
    try {
      await apiRequest<{ added: number; totalEntries: number }>(
        `/api/nfl-fantasy/leagues/${league.id}/populate-test-coaches`,
        { method: "POST" },
      );
      await load();
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
    if (!window.confirm("Quitter ce championnat ?")) return;
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
        `Supprimer le championnat "${league.name}" ? Action irréversible.`,
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

  if (error?.status === 404 || error?.status === 403) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Championnat introuvable</h1>
        <p className="mt-2 text-sm text-nuffle-anthracite/70">{error.message}</p>
        <Link href="/nfl-fantasy" className="mt-4 inline-block text-sm text-nuffle-gold hover:text-nuffle-gold">
          ← Retour à mes championnats
        </Link>
      </div>
    );
  }

  if (!league) {
    return <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>;
  }

  const isOwner = currentUserId !== null && currentUserId === league.ownerId;
  const isMember =
    currentUserId !== null && league.entries.some((e) => e.userId === currentUserId);
  const isDraft = league.status === "draft";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/nfl-fantasy" className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze">
          ← Mes championnats
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="nfl-fantasy-league-name">
              {league.name}
            </h1>
            <p className="mt-1 text-sm text-nuffle-anthracite/70">
              {league.cycle ? (
                <>
                  <span className="font-medium text-nuffle-bronze">
                    {league.cycle.label}
                  </span>{" "}
                  <span className="text-nuffle-anthracite/60">
                    (W{league.cycle.startWeek}–W{league.cycle.endWeek})
                  </span>{" "}
                  · Saison {league.seasonId}
                </>
              ) : (
                <>Saison {league.seasonId}</>
              )}{" "}
              · {league.entries.length}/{league.size} membres ·{" "}
              <span className="capitalize">{league.draftMode}</span>
            </p>
          </div>
          <span className="rounded-full bg-nuffle-ivory/60 px-3 py-1 text-xs font-medium uppercase tracking-wide text-nuffle-anthracite">
            {statusLabel(league.status)}
          </span>
        </div>
      </div>

      {league.inviteCode && (
        <div className="rounded-lg border border-nuffle-gold/30 bg-nuffle-gold/5 p-4">
          <p className="text-xs uppercase tracking-wide text-nuffle-gold">Invite code</p>
          <div className="mt-1 flex items-center gap-3">
            <code
              className="font-mono text-2xl tracking-widest text-nuffle-bronze"
              data-testid="nfl-fantasy-invite-code"
            >
              {league.inviteCode}
            </code>
            <button
              onClick={copyInvite}
              className="rounded-md border border-nuffle-bronze/30 px-2 py-1 text-xs text-nuffle-anthracite/80 hover:border-nuffle-gold"
            >
              {busy === "copied" ? "Copié ✓" : "Copier"}
            </button>
          </div>
          <p className="mt-2 text-xs text-nuffle-anthracite/60">
            Partage ce code via la page <Link href="/nfl-fantasy/join" className="underline">rejoindre</Link>.
          </p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-nuffle-anthracite">Membres</h2>
        <ul
          className="mt-3 divide-y divide-nuffle-bronze/20 rounded-lg border border-nuffle-bronze/20 bg-white"
          data-testid="nfl-fantasy-entries"
        >
          {league.entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-nuffle-anthracite">{entry.teamName}</p>
                <p className="text-xs text-nuffle-anthracite/60">
                  Rejoint le {new Date(entry.joinedAt).toLocaleDateString("fr-FR")}
                  {entry.userId === league.ownerId && (
                    <span className="ml-2 rounded-full bg-nuffle-gold/20 px-1.5 py-0.5 text-[10px] uppercase text-nuffle-gold">
                      Owner
                    </span>
                  )}
                  {entry.userId === currentUserId && entry.userId !== league.ownerId && (
                    <span className="ml-2 rounded-full bg-nuffle-bronze/20 px-1.5 py-0.5 text-[10px] uppercase text-nuffle-anthracite">
                      Toi
                    </span>
                  )}
                </p>
              </div>
              <span className="text-xs text-nuffle-anthracite/60">TV {entry.totalTV}</span>
            </li>
          ))}
        </ul>
      </section>

      {isMember && league.status === "in_progress" && (
        <section>
          <h2 className="text-lg font-semibold text-nuffle-anthracite">Ma semaine</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/nfl-fantasy/leagues/${league.id}/lineup`}
              className="rounded-md bg-nuffle-gold px-4 py-2 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80"
              data-testid="nfl-fantasy-lineup-cta"
            >
              🐀 Régler mon lineup
            </Link>
            <Link
              href={`/nfl-fantasy/leagues/${league.id}/matchups`}
              className="rounded-md border border-nuffle-bronze/30 px-4 py-2 text-sm font-medium text-nuffle-anthracite hover:border-nuffle-gold"
              data-testid="nfl-fantasy-matchups-cta"
            >
              📊 Matchups
            </Link>
            <Link
              href={`/nfl-fantasy/leagues/${league.id}/standings`}
              className="rounded-md border border-nuffle-bronze/30 px-4 py-2 text-sm font-medium text-nuffle-anthracite hover:border-nuffle-gold"
              data-testid="nfl-fantasy-standings-cta"
            >
              🏆 Classement
            </Link>
          </div>
        </section>
      )}

      {isMember && isDraft && (
        <section>
          <h2 className="text-lg font-semibold text-nuffle-anthracite">Draft</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/nfl-fantasy/leagues/${league.id}/draft`}
              className="rounded-md bg-nuffle-gold px-4 py-2 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80"
              data-testid="nfl-fantasy-draft-cta"
            >
              📋 Drafter mes joueurs
            </Link>
          </div>
        </section>
      )}

      {!isMember && league.status === "in_progress" && (
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={`/nfl-fantasy/leagues/${league.id}/matchups`}
            className="text-nuffle-gold hover:text-nuffle-gold"
          >
            📊 Voir matchups
          </Link>
          <Link
            href={`/nfl-fantasy/leagues/${league.id}/standings`}
            className="text-nuffle-gold hover:text-nuffle-gold"
          >
            🏆 Voir classement
          </Link>
        </div>
      )}

      {(isOwner || isMember) && (
        <section>
          <h2 className="text-lg font-semibold text-nuffle-anthracite">Actions</h2>
          {actionError && (
            <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {actionError}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {isOwner && isDraft && (
              <>
                <button
                  onClick={rename}
                  disabled={busy === "rename"}
                  className="rounded-md border border-nuffle-bronze/30 px-3 py-1.5 text-sm hover:border-nuffle-gold disabled:opacity-50"
                >
                  Renommer
                </button>
                <button
                  onClick={togglePrivacy}
                  disabled={busy === "privacy"}
                  className="rounded-md border border-nuffle-bronze/30 px-3 py-1.5 text-sm hover:border-nuffle-gold disabled:opacity-50"
                >
                  {league.type === "private"
                    ? "Rendre publique"
                    : "Rendre privée"}
                </button>
                <button
                  onClick={remove}
                  disabled={busy === "delete"}
                  className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:border-red-400 disabled:opacity-50"
                >
                  Supprimer
                </button>
                {testMode && league.entries.length < league.size && (
                  <button
                    onClick={populateTestCoaches}
                    disabled={busy === "populate"}
                    className="rounded-md border-2 border-dashed border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    title="Remplit le championnat avec des coachs de test (mode debug)"
                  >
                    {busy === "populate"
                      ? "Remplissage…"
                      : `🧪 Remplir avec ${league.size - league.entries.length} coachs de test`}
                  </button>
                )}
              </>
            )}
            {!isOwner && isMember && isDraft && (
              <button
                onClick={leave}
                disabled={busy === "leave"}
                className="rounded-md border border-nuffle-bronze/30 px-3 py-1.5 text-sm hover:border-nuffle-gold disabled:opacity-50"
              >
                Quitter le championnat
              </button>
            )}
            {!isDraft && (
              <p className="text-sm text-nuffle-anthracite/60">
                La saison est démarrée — les actions de configuration sont verrouillées.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
