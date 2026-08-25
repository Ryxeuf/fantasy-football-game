"use client";

/**
 * Une ligne d'effectif dans l'editeur commissaire.
 *
 * Repliee par defaut : la ligne resume le joueur (numero, nom, poste,
 * caracteristiques, SPP, competences). L'ancienne version affichait TOUS
 * les controles de TOUS les joueurs en meme temps — un mur de champs ou
 * il etait impossible de lire un effectif. L'edition se deplie a la
 * demande, joueur par joueur.
 */

import { useState } from "react";
import { apiRequest } from "../../../lib/api-client";
import { formatStatByLabel } from "../../../lib/format-stats";
import { PlayerEditPanel } from "./PlayerEditPanel";
import {
  CHARS,
  CHAR_LABELS,
  charValueOf,
  skillsOf,
} from "./roster-helpers";
import type { EditPlayer, PositionAccess, SkillCatalogItem } from "./types";

interface Props {
  leagueId: string;
  teamId: string;
  player: EditPlayer;
  busy: boolean;
  canRemove: boolean;
  access?: PositionAccess;
  catalog: readonly SkillCatalogItem[];
  skillName: (slug: string) => string;
  run: <T>(call: () => Promise<T>, successMessage: string) => Promise<T | null>;
}

export function PlayerRow({
  leagueId,
  teamId,
  player,
  busy,
  canRemove,
  access,
  catalog,
  skillName,
  run,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const skills = skillsOf(player);
  const positionName = access?.displayName ?? player.position;

  return (
    <li
      data-testid={`player-edit-${player.id}`}
      className={`rounded-lg border bg-white ${
        player.dead ? "border-red-200" : "border-gray-200"
      } ${expanded ? "ring-1 ring-nuffle-gold" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          data-testid={`player-toggle-${player.id}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-left hover:bg-gray-50 rounded px-1 py-0.5"
        >
          <span
            aria-hidden
            className="shrink-0 w-7 h-7 grid place-items-center rounded-full bg-nuffle-anthracite text-white text-xs font-bold"
          >
            {player.number}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-nuffle-anthracite">
              {player.name}
              {player.dead ? (
                <span className="ml-1.5 align-middle text-[10px] uppercase tracking-wide rounded px-1 py-0.5 bg-red-100 text-red-700">
                  mort
                </span>
              ) : null}
            </span>
            <span className="block truncate text-xs text-gray-500">
              {positionName}
            </span>
          </span>
          <span className="shrink-0 font-mono text-xs text-gray-600">
            {CHARS.map((c) => (
              <span key={c} className="mr-1.5">
                <span className="text-gray-400">{CHAR_LABELS[c]}</span>{" "}
                {formatStatByLabel(c, charValueOf(player, c))}
              </span>
            ))}
          </span>
          <span className="shrink-0 text-xs rounded bg-nuffle-ivory px-1.5 py-0.5 text-nuffle-bronze font-medium">
            {player.spp} PSP
          </span>
          <span className="hidden sm:flex flex-wrap gap-1 max-w-xs">
            {skills.slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-[11px] rounded bg-blue-50 px-1.5 py-0.5 text-blue-800"
              >
                {skillName(s)}
              </span>
            ))}
            {skills.length > 3 ? (
              <span className="text-[11px] text-gray-500">
                +{skills.length - 3}
              </span>
            ) : null}
          </span>
          <span aria-hidden className="ml-auto text-gray-400 text-xs">
            {expanded ? "▲ Replier" : "▼ Modifier"}
          </span>
        </button>

        {canRemove ? (
          confirmRemove ? (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                data-testid={`confirm-remove-player-${player.id}`}
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      apiRequest(
                        `/leagues/${leagueId}/teams/${teamId}/players/${player.id}`,
                        { method: "DELETE" },
                      ),
                    `${player.name} retiré de l'effectif`,
                  ).then(() => setConfirmRemove(false))
                }
                className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirmer
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmRemove(false)}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              data-testid={`remove-player-${player.id}`}
              disabled={busy}
              onClick={() => setConfirmRemove(true)}
              title={
                player.dead
                  ? "Retirer ce joueur mort du roster (fiche et historique conservés, aucun licenciement)"
                  : "Supprimer ce joueur (pré-saison, aucun match joué)"
              }
              className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {player.dead ? "🗑 Retirer" : "🗑 Supprimer"}
            </button>
          )
        ) : null}
      </div>

      {expanded ? (
        <PlayerEditPanel
          leagueId={leagueId}
          teamId={teamId}
          player={player}
          busy={busy}
          access={access}
          catalog={catalog}
          skillName={skillName}
          run={run}
        />
      ) : null}
    </li>
  );
}
