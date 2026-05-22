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
        <Link href="/nfl-fantasy" className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze">
          ← Mes championnats
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          Rejoindre un championnat
        </h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          Tu as un invite code d&apos;un championnat privé ? Saisis-le
          ci-dessous (8 caractères, sans I/L/O/0/1).
        </p>
        <div className="mt-3 rounded-md border border-nuffle-gold/30 bg-nuffle-gold/5 p-3 text-sm">
          <p className="text-nuffle-anthracite/80">
            🌐{" "}
            <strong>Pas de code ?</strong> Découvre les championnats
            publics ouverts à tous.
          </p>
          <Link
            href="/nfl-fantasy/public"
            className="mt-2 inline-block text-sm font-medium text-nuffle-gold hover:text-nuffle-red"
          >
            → Parcourir les championnats publics
          </Link>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-nuffle-bronze/20 bg-white p-6"
        data-testid="nfl-fantasy-join-form"
      >
        <div>
          <label htmlFor="inviteCode" className="text-sm font-medium text-nuffle-anthracite">
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
            className="mt-1 w-full rounded-md border border-nuffle-bronze/30 bg-white px-3 py-2 font-mono text-base tracking-wider text-nuffle-anthracite placeholder:text-nuffle-anthracite/50 focus:border-nuffle-gold focus:outline-none"
            placeholder="ABCD2345"
          />
        </div>

        <div>
          <label htmlFor="teamName" className="text-sm font-medium text-nuffle-anthracite">
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
            className="mt-1 w-full rounded-md border border-nuffle-bronze/30 bg-white px-3 py-2 text-sm text-nuffle-anthracite placeholder:text-nuffle-anthracite/60 focus:border-nuffle-gold focus:outline-none"
            placeholder="Les Rats Saucissons"
          />
          <p className="mt-1 text-[11px] text-nuffle-anthracite/60">Unique par championnat.</p>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/nfl-fantasy"
            className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-nuffle-gold px-4 py-2 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80 disabled:cursor-not-allowed disabled:bg-nuffle-bronze/20"
          >
            {submitting ? "Connexion…" : "Rejoindre"}
          </button>
        </div>
      </form>
    </div>
  );
}
