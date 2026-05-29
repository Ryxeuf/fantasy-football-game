"use client";

import Link from "next/link";

import { RaceIcon } from "../../../RaceIcon";

export interface PlayerCardData {
  rosterId: string;
  acquiredVia: string;
  tvCost: number;
  player: {
    id: string;
    pseudonym: string;
    teamCode: string | null;
    nflPosition: string;
    bbPosition: string;
    jerseyNumber: number | null;
    status: string;
    currentValue?: number;
    bbRace?: string | null;
    raceLabel?: string | null;
    lastSpp?: number | null;
    lastWeekId?: string | null;
  } | null;
}

interface PlayerCardProps {
  row: PlayerCardData;
  isStarter: boolean;
  isCaptain: boolean;
  isVice: boolean;
  locked: boolean;
  canAddMore: boolean;
  onToggle: () => void;
  onCaptain: () => void;
  onVice: () => void;
}

/**
 * Card joueur unitaire utilisee dans les sections Lineup / Disponibles.
 * Mobile-first : tout est empile + tappable sur mobile, plus dense sur
 * desktop (>= sm). Le bord et le fond changent selon l'etat :
 *   - Captain : bordure gold + fond amber clair + 👑 prominent
 *   - Vice    : bordure silver + fond slate clair + 🥈
 *   - Starter : bordure gold fade + fond gold/5
 *   - Bench   : bordure neutre + fond blanc
 */
export function PlayerCard({
  row,
  isStarter,
  isCaptain,
  isVice,
  locked,
  canAddMore,
  onToggle,
  onCaptain,
  onVice,
}: PlayerCardProps) {
  const player = row.player;
  if (!player) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-3 text-xs text-nuffle-anthracite/40">
        Joueur inconnu (roster {row.rosterId.slice(0, 6)})
      </div>
    );
  }

  const borderTone = isCaptain
    ? "border-amber-400 bg-amber-50/60"
    : isVice
      ? "border-slate-400 bg-slate-50/60"
      : isStarter
        ? "border-nuffle-gold/40 bg-nuffle-gold/5"
        : "border-nuffle-bronze/20 bg-white";

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${borderTone}`}
      data-testid={`player-card-${player.id}`}
    >
      {/* Ligne 1 : badge role + race + nom + cote */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isCaptain && (
              <span
                className="rounded-full bg-gradient-to-br from-amber-300 to-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-950"
                title="Captain ×1.5"
              >
                👑 C
              </span>
            )}
            {isVice && (
              <span
                className="rounded-full bg-gradient-to-br from-slate-300 to-slate-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-50"
                title="Vice-captain ×1.2"
              >
                🥈 V
              </span>
            )}
            <RaceIcon
              race={player.bbRace ?? null}
              label={player.raceLabel ?? null}
              className="text-base leading-none"
            />
            <Link
              href={`/nfl-fantasy/players/${player.id}`}
              className="truncate font-semibold text-nuffle-anthracite hover:text-nuffle-bronze hover:underline"
            >
              {player.pseudonym}
            </Link>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-nuffle-anthracite/60">
            <span className="font-medium text-nuffle-anthracite/80">
              {player.bbPosition}
            </span>
            <span>·</span>
            <span>{player.nflPosition}</span>
            <span>·</span>
            <span>{player.teamCode ?? "FA"}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-semibold text-nuffle-anthracite">
            {player.currentValue != null ? `${player.currentValue} TV` : "—"}
          </div>
          {player.lastSpp != null && (
            <div
              className="mt-0.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
              title={player.lastWeekId ? `Semaine ${player.lastWeekId}` : undefined}
            >
              {player.lastSpp} SPP
            </div>
          )}
        </div>
      </div>

      {/* Ligne 2 : actions (cachees si lineup lockee) */}
      {!locked && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isStarter ? (
            <>
              <RoleButton
                label="Captain"
                emoji="👑"
                active={isCaptain}
                tone="captain"
                onClick={onCaptain}
                testId={`card-captain-${player.id}`}
              />
              <RoleButton
                label="Vice"
                emoji="🥈"
                active={isVice}
                tone="vice"
                onClick={onVice}
                testId={`card-vice-${player.id}`}
              />
              <button
                type="button"
                onClick={onToggle}
                className="ml-auto inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:border-red-400 hover:bg-red-50"
                data-testid={`card-remove-${player.id}`}
              >
                <span aria-hidden>×</span> Retirer
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              disabled={!canAddMore}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-nuffle-gold px-3 py-1.5 text-xs font-semibold text-nuffle-anthracite shadow-sm hover:bg-nuffle-gold/80 disabled:cursor-not-allowed disabled:bg-nuffle-bronze/20 disabled:text-nuffle-anthracite/40"
              data-testid={`card-add-${player.id}`}
              title={canAddMore ? undefined : "Lineup plein (11 starters)"}
            >
              + Ajouter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface RoleButtonProps {
  label: string;
  emoji: string;
  active: boolean;
  tone: "captain" | "vice";
  onClick: () => void;
  testId: string;
}

function RoleButton({ label, emoji, active, tone, onClick, testId }: RoleButtonProps) {
  const activeCls =
    tone === "captain"
      ? "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-sm"
      : "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-50 shadow-sm";
  const inactiveCls =
    "bg-nuffle-bronze/10 text-nuffle-anthracite/60 hover:bg-nuffle-bronze/20";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-testid={testId}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
        active ? activeCls : inactiveCls
      }`}
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </button>
  );
}
