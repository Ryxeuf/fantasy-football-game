"use client";

/**
 * Onglet « Ligue régionale ».
 *
 * Le choix est immuable pour le coach (il conditionne les Star Players
 * recrutables et les Coups de Pouce d'une saison entière) : personne ne
 * pouvait donc rattraper une erreur de saisie. Le commissaire le peut,
 * avec l'avertissement sur les Star Players déjà recrutés qui ne seraient
 * plus éligibles — ils restent en place, l'arbitrage lui revient.
 */

import { useState } from "react";
import { apiRequest } from "../../../lib/api-client";
import { humanizeSlug } from "./roster-helpers";
import type { RegionalLeagueUpdate, TeamSettings } from "./types";

interface Props {
  leagueId: string;
  teamId: string;
  settings: TeamSettings;
  busy: boolean;
  run: <T>(call: () => Promise<T>, successMessage: string) => Promise<T | null>;
}

/** Valeur du radio « aucun choix enregistré » (envoyée en `null`). */
const NONE = "__none__";

export function RegionalLeagueTab({
  leagueId,
  teamId,
  settings,
  busy,
  run,
}: Props) {
  const { regionalLeague } = settings;
  const [choice, setChoice] = useState(regionalLeague.current ?? NONE);
  const [orphans, setOrphans] = useState<readonly string[]>([]);

  if (!regionalLeague.applicable) {
    return (
      <p
        data-testid="regional-not-applicable"
        className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-3"
      >
        Le règlement de tournoi
        {settings.team.tournamentRulesetLabel
          ? ` « ${settings.team.tournamentRulesetLabel} »`
          : ""}{" "}
        de cette équipe neutralise l&apos;axe régional : aucune Ligue
        régionale n&apos;est à choisir.
      </p>
    );
  }

  if (regionalLeague.options.length === 0) {
    return (
      <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
        Aucune Ligue régionale n&apos;est déclarée pour le roster{" "}
        {settings.team.roster}.
      </p>
    );
  }

  const dirty = choice !== (regionalLeague.current ?? NONE);

  return (
    <div data-testid="regional-league-panel" className="space-y-3">
      <p className="text-xs text-gray-600">
        Ligue actuelle :{" "}
        <strong>
          {regionalLeague.currentLabel ?? "aucune (règles historiques du roster)"}
        </strong>
        . Elle détermine les Star Players recrutables et les Coups de Pouce
        accessibles.
      </p>

      {settings.starPlayers.length > 0 ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          {settings.starPlayers.length} Star Player(s) déjà recruté(s) :
          changer de Ligue peut les rendre inéligibles.
        </p>
      ) : null}

      <ul className="space-y-2">
        {regionalLeague.options.map((o) => (
          <li key={o.slug}>
            <label
              className={`flex gap-2 rounded-lg border p-2.5 cursor-pointer ${
                choice === o.slug
                  ? "border-nuffle-gold bg-nuffle-ivory/40"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="regional-league"
                value={o.slug}
                checked={choice === o.slug}
                disabled={busy}
                data-testid={`regional-option-${o.slug}`}
                onChange={() => setChoice(o.slug)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-nuffle-anthracite">
                  {o.label}
                  {regionalLeague.current === o.slug ? (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide rounded px-1 py-0.5 bg-green-100 text-green-800">
                      actuelle
                    </span>
                  ) : null}
                </span>
                {o.description ? (
                  <span className="block text-xs text-gray-600 mt-0.5 line-clamp-3">
                    {o.description}
                  </span>
                ) : null}
                {o.grants.length > 0 ? (
                  <span className="block text-[11px] text-nuffle-bronze mt-1">
                    Alignements : {o.grants.join(", ")}
                  </span>
                ) : null}
              </span>
            </label>
          </li>
        ))}
        <li>
          <label
            className={`flex gap-2 rounded-lg border p-2.5 cursor-pointer ${
              choice === NONE
                ? "border-nuffle-gold bg-nuffle-ivory/40"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="regional-league"
              value={NONE}
              checked={choice === NONE}
              disabled={busy}
              data-testid="regional-option-none"
              onChange={() => setChoice(NONE)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-nuffle-anthracite">
                Aucun choix enregistré
              </span>
              <span className="block text-xs text-gray-600 mt-0.5">
                L&apos;équipe retombe sur l&apos;union historique des règles
                régionales de son roster.
              </span>
            </span>
          </label>
        </li>
      </ul>

      {orphans.length > 0 ? (
        <p
          data-testid="regional-orphans"
          className="text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5"
        >
          Star Player(s) désormais inéligible(s), laissé(s) en place :{" "}
          {orphans.map(humanizeSlug).join(", ")}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="regional-save"
          disabled={busy || !dirty}
          onClick={() =>
            run<RegionalLeagueUpdate>(
              () =>
                apiRequest<RegionalLeagueUpdate>(
                  `/leagues/${leagueId}/teams/${teamId}/regional-league`,
                  {
                    method: "PATCH",
                    body: JSON.stringify({
                      regionalLeague: choice === NONE ? null : choice,
                    }),
                  },
                ),
              "Ligue régionale mise à jour",
            ).then((res) => {
              if (res) setOrphans(res.orphanedStarPlayers ?? []);
            })
          }
          className="px-3 py-1 rounded bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
        >
          Enregistrer la Ligue
        </button>
        {dirty ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setChoice(regionalLeague.current ?? NONE)}
            className="px-2 py-1 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>
        ) : null}
      </div>
    </div>
  );
}
