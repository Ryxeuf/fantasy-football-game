"use client";

/**
 * Briques d'affichage d'un joueur, partagées par le TABLEAU (écran large) et
 * les CARTES (mobile) de `TeamRosterPanel` : une seule source par
 * information, quelle que soit la mise en page.
 */

import { trackUmamiEvent, UMAMI_EVENTS } from "../../lib/umami-events";
import {
  availabilityOf,
  deathOriginLabel,
  lastingInjuriesLabel,
  type RosterPlayerViewSource,
} from "./roster-player-view";
import {
  competitionPlayerCardUrl,
  type CompetitionCardContext,
  type CompetitionCardPlayer,
} from "./player-card-export";

type Variant = "table" | "mobile";

function testIdFor(base: string, id: string, variant: Variant): string {
  return variant === "mobile" ? `${base}-mobile-${id}` : `${base}-${id}`;
}

export function PlayerNoteBadge({
  playerId,
  note,
  variant,
}: {
  playerId: string;
  note: string | null | undefined;
  variant: Variant;
}) {
  if (!note) return null;
  return (
    <span
      data-testid={testIdFor("player-note", playerId, variant)}
      className="rounded bg-nuffle-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-nuffle-bronze"
    >
      {note}
    </span>
  );
}

export function PlayerDeathMark({
  player,
  playerId,
  variant,
}: {
  player: RosterPlayerViewSource;
  playerId: string;
  variant: Variant;
}) {
  if (!player.dead) return null;
  return (
    <span
      title={deathOriginLabel(player)}
      data-testid={testIdFor("player-death-origin", playerId, variant)}
    >
      {" ☠"}
    </span>
  );
}

export function PlayerInjuries({
  player,
  playerId,
  variant,
}: {
  player: RosterPlayerViewSource;
  playerId: string;
  variant: Variant;
}) {
  const injuries = lastingInjuriesLabel(player);
  return (
    <span
      className="text-xs text-red-700"
      data-testid={testIdFor("player-injuries", playerId, variant)}
    >
      {injuries || <span className="text-gray-300">—</span>}
    </span>
  );
}

export function PlayerAvailability({
  player,
  playerId,
  variant,
}: {
  player: RosterPlayerViewSource;
  playerId: string;
  variant: Variant;
}) {
  const status = availabilityOf(player);
  return (
    <span data-testid={testIdFor("player-availability", playerId, variant)}>
      {status === "dead" ? (
        <span title={deathOriginLabel(player)}>☠</span>
      ) : status === "absent" ? (
        <span
          className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700"
          title="Rate le prochain match (blessure)"
        >
          Absent
        </span>
      ) : (
        <span className="text-emerald-600" title="Disponible pour le prochain match">
          ✓{variant === "mobile" ? " Disponible" : ""}
        </span>
      )}
    </span>
  );
}

export function RemoveDeadButton({
  playerId,
  removing,
  onClick,
  variant,
}: {
  playerId: string;
  removing: boolean;
  onClick: () => void;
  variant: Variant;
}) {
  return (
    <button
      type="button"
      data-testid={testIdFor("remove-dead-player", playerId, variant)}
      disabled={removing}
      onClick={onClick}
      title="Retirer ce joueur mort du roster (fiche et historique conservés, aucun licenciement)"
      className="whitespace-nowrap rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 no-underline hover:bg-red-50 disabled:opacity-50"
    >
      {removing ? "…" : "Retirer"}
    </button>
  );
}

function openCard(url: string, download: boolean): void {
  trackUmamiEvent(UMAMI_EVENTS.CARD_EXPORT, { kind: "competition", download });
  const link = document.createElement("a");
  link.href = url;
  if (!download) {
    link.target = "_blank";
    link.rel = "noopener";
  }
  link.click();
}

/** Boutons « Voir la carte » / « PNG », comme sur la fiche « Mes équipes ». */
export function PlayerCardButtons({
  playerId,
  player,
  context,
  variant,
}: {
  playerId: string;
  player: CompetitionCardPlayer;
  context: CompetitionCardContext;
  variant: Variant;
}) {
  const mobile = variant === "mobile";
  const base = "rounded border border-gray-300 font-medium text-gray-700 hover:bg-gray-100";
  const size = mobile ? "px-2.5 py-1.5 text-xs" : "px-2 py-1 text-xs";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        data-testid={testIdFor("player-card", playerId, variant)}
        onClick={() => openCard(competitionPlayerCardUrl(player, context, false), false)}
        title="Voir la carte du joueur (PNG façon carte officielle)"
        className={`whitespace-nowrap ${base} ${size}`}
      >
        🃏{mobile ? " Voir la carte" : ""}
      </button>
      <button
        type="button"
        data-testid={testIdFor("player-card-download", playerId, variant)}
        onClick={() => openCard(competitionPlayerCardUrl(player, context, true), true)}
        title="Télécharger la carte PNG"
        className={`whitespace-nowrap ${base} ${size}`}
      >
        ⬇️{mobile ? " PNG" : ""}
      </button>
    </div>
  );
}
