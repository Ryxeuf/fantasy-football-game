"use client";

import SkillTooltip from "../../me/teams/components/SkillTooltip";
import SkillAccessBadges from "../../me/teams/components/SkillAccessBadges";
import KeywordChips from "../KeywordChips";
import PlayerAvatar from "../PlayerAvatar";
import type { RosterPlayer } from "../TeamRosterPanel";
import type { PositionMeta, PositionSkillAccess } from "../../me/teams/[id]/roster-skill-access";
import {
  formatTarget,
  hasTeamPlayerCard,
  playerValueLabel,
  rosterStatCells,
  rosterStatTestId,
} from "./roster-player-view";
import {
  PlayerAvailability,
  PlayerCardButtons,
  PlayerDeathMark,
  PlayerInjuries,
  PlayerNoteBadge,
  RemoveDeadButton,
} from "./RosterPlayerParts";

export interface RosterPlayerCardProps {
  player: RosterPlayer;
  competition: "league" | "cup";
  teamName: string;
  rosterSlug: string;
  ruleset?: string;
  positionMeta?: PositionMeta;
  skillAccess?: PositionSkillAccess;
  showInjuries: boolean;
  canRemoveDead: boolean;
  removing: boolean;
  onRemoveDead?: () => void;
}

/**
 * Carte d'un joueur pour les écrans étroits — mise en page de la fiche
 * « Mes équipes » (identité, caractéristiques, compétences, accès, carte
 * PNG), complétée de TOUT ce que le tableau de la compétition affiche :
 * statistiques, PSP, valeur, blessures durables et disponibilité.
 */
export default function RosterPlayerCard({
  player: p,
  competition,
  teamName,
  rosterSlug,
  ruleset,
  positionMeta,
  skillAccess,
  showInjuries,
  canRemoveDead,
  removing,
  onRemoveDead,
}: RosterPlayerCardProps) {
  const positionName = p.positionName ?? positionMeta?.displayName ?? p.position;
  const characteristics: Array<[string, string]> = [
    ["MA", String(p.ma)],
    ["ST", String(p.st)],
    ["AG", formatTarget(p.ag)],
    ["PA", formatTarget(p.pa)],
    ["AV", formatTarget(p.av)],
  ];

  return (
    <article
      data-testid={`roster-player-card-${p.id}`}
      className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${p.dead ? "opacity-70" : ""}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerAvatar name={p.name} imageUrl={p.imageUrl} size={40} />
          <span className="font-mono text-xl font-bold text-gray-900">
            {p.number ?? "—"}
          </span>
          <div className="min-w-0">
            <div
              className={`flex flex-wrap items-center gap-1.5 break-words text-base font-semibold text-nuffle-anthracite ${
                p.dead ? "text-gray-500 line-through" : ""
              }`}
            >
              {p.name}
              <PlayerNoteBadge playerId={p.id} note={p.note} variant="mobile" />
              <PlayerDeathMark player={p} playerId={p.id} variant="mobile" />
            </div>
            <div className="text-xs text-gray-600">{positionName}</div>
            <KeywordChips keywords={positionMeta?.keywords} className="mt-1" />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-gray-500">Valeur</div>
          <div
            className="whitespace-nowrap text-sm font-semibold tabular-nums"
            data-testid={`player-value-mobile-${p.id}`}
          >
            {playerValueLabel(p.value)}
          </div>
          {canRemoveDead && p.dead ? (
            <div className="mt-2">
              <RemoveDeadButton
                playerId={p.id}
                removing={removing}
                onClick={() => onRemoveDead?.()}
                variant="mobile"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-5 gap-2 text-xs">
        {characteristics.map(([label, value]) => (
          <div key={label} className="text-center">
            <div className="text-gray-500">{label}</div>
            <div className="font-mono font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1 text-xs text-gray-500">Compétences</div>
        <SkillTooltip
          skillsString={p.skills}
          position={p.position}
          teamName={rosterSlug}
          ruleset={ruleset}
          useDirectParsing
          dbBaseSkills={positionMeta?.baseSkills}
          advancements={p.advancements}
        />
        <SkillAccessBadges
          primary={skillAccess?.primary ?? null}
          secondary={skillAccess?.secondary ?? null}
        />
      </div>

      <dl
        className="mt-3 grid grid-cols-7 gap-1 rounded-md border border-gray-200 bg-white px-1 py-2 text-xs"
        data-testid={`player-stats-mobile-${p.id}`}
      >
        {rosterStatCells(p, competition).map((cell) => (
          <div key={cell.key} className="text-center" title={cell.title}>
            <dt className="text-gray-500">{cell.label}</dt>
            <dd
              className="font-mono font-semibold tabular-nums"
              data-testid={rosterStatTestId(cell.key, p.id, "mobile")}
            >
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>

      {showInjuries ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className="text-gray-500"
              title="Blessures durables : BP = Blessure Persistante (cumulable), plus les réductions de caractéristique (Séquelles)"
            >
              Blessures :
            </span>
            <PlayerInjuries player={p} playerId={p.id} variant="mobile" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Prochain match :</span>
            <PlayerAvailability player={p} playerId={p.id} variant="mobile" />
          </div>
        </div>
      ) : null}

      {hasTeamPlayerCard(p) ? (
        <div className="mt-3">
          <PlayerCardButtons
            playerId={p.id}
            player={p}
            context={{
              teamName,
              rosterSlug,
              positionName,
              positionImageUrl: positionMeta?.imageUrl ?? null,
            }}
            variant="mobile"
          />
        </div>
      ) : null}
    </article>
  );
}
