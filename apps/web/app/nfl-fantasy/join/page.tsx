"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { apiRequest, ApiClientError } from "../../lib/api-client";
import type { NflFantasyEntry } from "../types";

export default function JoinLeaguePage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const entry = await apiRequest<NflFantasyEntry>(
        "/api/nfl-fantasy/leagues/join-by-code",
        {
          method: "POST",
          body: JSON.stringify({
            inviteCode: inviteCode.trim().toUpperCase(),
            teamName: teamName.trim(),
          }),
        },
      );
      router.push(`/nfl-fantasy/leagues/${entry.leagueId}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) setError("Connecte-toi d'abord.");
        else if (err.status === 404) setError("Invite code invalide.");
        else setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <Link href="/nfl-fantasy" className="text-sm text-slate-400 hover:text-white">
          ← Mes leagues
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Rejoindre une league</h1>
        <p className="mt-1 text-sm text-slate-400">
          Demande l&apos;invite code à un membre. Le code est unique par league
          (8 caractères, alphabet sans I/L/O/0/1).
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6"
        data-testid="nfl-fantasy-join-form"
      >
        <div>
          <label htmlFor="inviteCode" className="text-sm font-medium text-slate-200">
            Invite code
          </label>
          <input
            id="inviteCode"
            type="text"
            required
            minLength={4}
            maxLength={16}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-base tracking-wider text-white placeholder:text-slate-600 focus:border-orange-400 focus:outline-none"
            placeholder="ABCD2345"
          />
        </div>

        <div>
          <label htmlFor="teamName" className="text-sm font-medium text-slate-200">
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
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none"
            placeholder="Les Rats Saucissons"
          />
          <p className="mt-1 text-[11px] text-slate-500">Unique par league.</p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/nfl-fantasy"
            className="text-sm text-slate-400 hover:text-white"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {submitting ? "Connexion…" : "Rejoindre"}
          </button>
        </div>
      </form>
    </div>
  );
}
