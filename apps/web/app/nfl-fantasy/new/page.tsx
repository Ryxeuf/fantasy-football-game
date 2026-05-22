"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { apiRequest, ApiClientError } from "../../lib/api-client";
import type { LeagueType, LeagueWithEntries } from "../types";

// V1 : seul mode supporte cote backend (les autres champs DB sont
// conserves pour future extension snake interactif / vraies encheres).
const HARDCODED_DRAFT_MODE = "auction" as const;

// On essaie 2026 (saison NFL a venir) puis 2025 en fallback. Cote
// snap-to-next-window : la 1ere saison qui a un cycle joignable
// (status=upcoming) est utilisee comme defaut.
const CANDIDATE_SEASONS = ["2026", "2025"] as const;

interface CycleStatus {
  readonly id: string;
  readonly seasonId: string;
  readonly cycleNumber: number;
  readonly cycleType: "regular" | "playoffs";
  readonly label: string;
  readonly startWeek: number;
  readonly endWeek: number;
  readonly status: "upcoming" | "active" | "closed";
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

interface CyclesResponse {
  readonly cycles: CycleStatus[];
}

export default function NewLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [size, setSize] = useState(10);
  const [type, setType] = useState<LeagueType>("private");
  const [draftBudget, setDraftBudget] = useState<number>(5000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cycle resolution : on appelle l'API pour chaque saison candidate
  // jusqu'a en trouver une qui a un cycle "upcoming". Le championnat
  // sera adosse a ce cycle (snap-to-next-window).
  const [resolvedCycle, setResolvedCycle] = useState<CycleStatus | null>(null);
  const [resolvingCycle, setResolvingCycle] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function resolveCycle() {
      for (const seasonId of CANDIDATE_SEASONS) {
        try {
          const out = await apiRequest<CyclesResponse>(
            `/api/nfl-fantasy/cycles?seasonId=${encodeURIComponent(seasonId)}`,
          );
          const upcoming = out.cycles
            .filter((c) => c.status === "upcoming")
            .sort((a, b) => a.cycleNumber - b.cycleNumber);
          if (upcoming.length > 0 && !cancelled) {
            setResolvedCycle(upcoming[0]);
            setResolvingCycle(false);
            return;
          }
        } catch {
          // Ignore, on essaie la saison suivante.
        }
      }
      if (!cancelled) {
        setResolvingCycle(false);
        setError(
          "Aucune mini-saison n'est ouverte pour creation en ce moment. Reviens quand la prochaine debute.",
        );
      }
    }
    void resolveCycle();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!resolvedCycle) {
      setError("Aucun cycle joignable disponible.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const league = await apiRequest<LeagueWithEntries>(
        "/api/nfl-fantasy/leagues",
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            teamName: teamName.trim(),
            seasonId: resolvedCycle.seasonId,
            cycleId: resolvedCycle.id,
            size,
            type,
            draftMode: HARDCODED_DRAFT_MODE,
            draftBudget,
          }),
        },
      );
      router.push(`/nfl-fantasy/leagues/${league.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.status === 401 ? "Connecte-toi d'abord." : err.message);
      } else {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/nfl-fantasy" className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze">
          ← Mes championnats
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Créer un championnat</h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          Tu seras owner et membre #1 de le championnat. Un invite code sera généré
          si tu choisis &ldquo;privée&rdquo;.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-nuffle-bronze/20 bg-white p-6"
        data-testid="nfl-fantasy-new-form"
      >
        <div>
          <label htmlFor="name" className="text-sm font-medium text-nuffle-anthracite">
            Nom de le championnat
          </label>
          <input
            id="name"
            type="text"
            required
            minLength={3}
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-nuffle-bronze/30 bg-white px-3 py-2 text-sm text-nuffle-anthracite placeholder:text-nuffle-anthracite/60 focus:border-nuffle-gold focus:outline-none"
            placeholder="Le championnat des Krak'Skar"
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
            placeholder="Les Rongeurs du Bayou"
          />
        </div>

        <div className="rounded-lg border border-nuffle-bronze/30 bg-nuffle-ivory/40 p-4">
          <p className="text-xs uppercase tracking-wide text-nuffle-bronze">
            Mini-saison ciblée
          </p>
          {resolvingCycle && (
            <p className="mt-2 text-sm text-nuffle-anthracite/70">
              Recherche du prochain cycle joignable…
            </p>
          )}
          {!resolvingCycle && resolvedCycle && (
            <div className="mt-1">
              <p className="font-heading text-lg text-nuffle-anthracite">
                {resolvedCycle.label}{" "}
                <span className="text-sm font-normal text-nuffle-anthracite/70">
                  · Saison {resolvedCycle.seasonId}
                </span>
              </p>
              <p className="mt-1 text-xs text-nuffle-anthracite/70">
                Semaines NFL {resolvedCycle.startWeek}–{resolvedCycle.endWeek}
                {resolvedCycle.startsAt && (
                  <>
                    {" "}
                    · Démarre le{" "}
                    {new Date(resolvedCycle.startsAt).toLocaleDateString(
                      "fr-FR",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}
                  </>
                )}
              </p>
              <p className="mt-2 text-[11px] text-nuffle-anthracite/60">
                Snap-to-next-window : on ne peut pas créer de championnat sur
                une mini-saison déjà démarrée. La création tardive bascule
                automatiquement sur la prochaine.
              </p>
            </div>
          )}
          {!resolvingCycle && !resolvedCycle && (
            <p className="mt-2 text-sm text-nuffle-red">
              Aucune mini-saison joignable pour le moment.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="size" className="text-sm font-medium text-nuffle-anthracite">
            Taille
          </label>
          <input
            id="size"
            type="number"
            min={2}
            max={16}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-nuffle-bronze/30 bg-white px-3 py-2 text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-nuffle-anthracite/60">2-16 coachs ; défaut 10</p>
        </div>

        <div className="rounded-lg border border-nuffle-gold/30 bg-nuffle-gold/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-nuffle-anthracite">
            🤫 Mercato à enchères secrètes
          </h3>
          <p className="mt-2 text-xs text-nuffle-anthracite/80">
            L&apos;owner ouvre des sessions de mercato de 48h pendant
            lesquelles chaque coach pose des enchères{" "}
            <strong>cachées</strong> sur les joueurs qu&apos;il convoite.
          </p>
          <p className="mt-2 text-xs text-nuffle-anthracite/80">
            À la fermeture, le plus offrant remporte le joueur — en cas
            d&apos;égalité, c&apos;est le coach avec le plus petit
            roster qui gagne. Les enchères perdantes ne sont pas
            facturées : tu peux bluffer sans craindre de te ruiner.
          </p>

          <div className="mt-4 border-t border-nuffle-gold/20 pt-4">
            <label
              htmlFor="draftBudget"
              className="text-sm font-medium text-nuffle-anthracite"
            >
              Budget initial par coach (Team Value)
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="draftBudget"
                type="range"
                min={1000}
                max={20000}
                step={500}
                value={draftBudget}
                onChange={(e) => setDraftBudget(Number(e.target.value))}
                className="flex-1 accent-nuffle-gold"
              />
              <input
                type="number"
                min={1000}
                max={20000}
                step={100}
                value={draftBudget}
                onChange={(e) =>
                  setDraftBudget(
                    Math.min(20000, Math.max(1000, Number(e.target.value))),
                  )
                }
                className="w-24 rounded-md border border-nuffle-bronze/30 bg-white px-2 py-1 text-right font-mono text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
              />
              <span className="text-xs text-nuffle-anthracite/70">TV</span>
            </div>
            <p className="mt-2 text-[11px] text-nuffle-anthracite/60">
              Range 1000-20000. Défaut 5000 TV : permet de drafter ~10-15
              joueurs avec un mix de stars et de rookies. Plus haut =
              encheres folles entre coachs ; plus bas = chaque TV compte.
            </p>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-nuffle-anthracite">Visibilité</legend>
          <div className="mt-2 flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="type"
                value="private"
                checked={type === "private"}
                onChange={() => setType("private")}
              />
              <span>Privée (invite code)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="type"
                value="public"
                checked={type === "public"}
                onChange={() => setType("public")}
              />
              <span>Publique</span>
            </label>
          </div>
        </fieldset>

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
            disabled={submitting || resolvingCycle || !resolvedCycle}
            className="rounded-md bg-nuffle-gold px-4 py-2 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80 disabled:cursor-not-allowed disabled:bg-nuffle-bronze/20"
          >
            {submitting ? "Création…" : "Créer le championnat"}
          </button>
        </div>
      </form>
    </div>
  );
}
