"use client";

import { useMemo } from "react";
import {
  getDisplayName,
  getPlayerCost,
  SURCHARGE_PER_ADVANCEMENT,
} from "@bb/game-engine";
import PlayerAvatar from "../../components/PlayerAvatar";
import KeywordChips from "../../components/KeywordChips";
import SkillTooltip from "../../me/teams/components/SkillTooltip";
import SkillAccessBadges from "../../me/teams/components/SkillAccessBadges";
import {
  buildPositionMetaByPosition,
  buildSkillAccessByPosition,
  makePositionResolvers,
  type RosterPositionLike,
} from "../../me/teams/[id]/roster-skill-access";
import {
  makePlayerValueResolver,
  type PlayerValueView,
} from "../../me/teams/[id]/roster-player-value";
import { formatPlusStat } from "../../lib/format-stats";
import { prettifySlug } from "../../lib/roster-display";
import { useLanguage } from "../../contexts/LanguageContext";

/**
 * Effectif d'une équipe partagée publiquement.
 *
 * Composant CLIENT parce que l'affichage des compétences est celui de la
 * fiche du coach : badges base/acquise (`SkillTooltip`) avec description au
 * survol, et badges d'accès primaire/secondaire. La page serveur lui
 * fournit le catalogue de compétences (`SkillsCatalogProvider`) et le
 * détail du roster, pour que les libellés soient corrects dès le HTML
 * initial — un lien partagé est souvent ouvert une seule fois, il n'a pas
 * droit au flash « slug brut puis vrai nom ».
 *
 * Les coûts ne sont JAMAIS re-dérivés ici : `playerValues` vient du serveur
 * (même résolution que la VE). Les replis locaux ne servent que face à un
 * serveur pré-correctif.
 */

export interface PublicRosterPlayer {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly number: number;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: unknown;
  readonly imageUrl?: string | null;
  readonly advancements?: string | null;
}

interface PublicRosterTableProps {
  readonly players: readonly PublicRosterPlayer[];
  readonly rosterSlug: string;
  readonly ruleset: string;
  /** Positions du roster (`/api/rosters/:slug`) : libellés, coûts, base. */
  readonly positions: readonly RosterPositionLike[] | null;
  /** Valeur par joueur servie par l'API, indexée par id. */
  readonly playerValues?: Readonly<Record<string, PlayerValueView>>;
}

/** « 130 000 po » → « 130K po ». */
function formatKpo(valuePo: number): string {
  return `${Math.round(valuePo / 1000).toLocaleString("fr-FR")}K po`;
}

export default function PublicRosterTable({
  players,
  rosterSlug,
  ruleset,
  positions,
  playerValues,
}: PublicRosterTableProps) {
  const { language } = useLanguage();

  const positionMeta = useMemo(
    () => buildPositionMetaByPosition(positions),
    [positions],
  );
  const skillAccess = useMemo(
    () => buildSkillAccessByPosition(positions),
    [positions],
  );
  const resolvers = useMemo(
    () =>
      makePositionResolvers(positionMeta, {
        cost: getPlayerCost,
        displayName: getDisplayName,
      }),
    [positionMeta],
  );
  const playerValuePo = useMemo(
    () =>
      makePlayerValueResolver({
        served: playerValues,
        hireCostOf: (position: string) => resolvers.costPo(position, rosterSlug),
        surchargeByType: SURCHARGE_PER_ADVANCEMENT,
      }),
    [playerValues, resolvers, rosterSlug],
  );

  const sorted = useMemo(
    () => [...players].sort((a, b) => a.number - b.number),
    [players],
  );

  const skillsOf = (player: PublicRosterPlayer): string =>
    typeof player.skills === "string"
      ? player.skills
      : Array.isArray(player.skills)
        ? player.skills.filter((s): s is string => typeof s === "string").join(",")
        : "";

  /**
   * Libellé du poste : la BASE d'abord (`/api/rosters/:slug`), le catalogue
   * compilé ensuite. Dernier recours, le slug prettifié — `getDisplayName`
   * rend le slug BRUT pour une position qu'il ne connaît pas, et la page
   * publique afficherait alors « skaven_blitzer » là où elle montrait
   * « Skaven Blitzer » avant ce lot.
   */
  const positionLabel = (position: string): string => {
    const label = resolvers.displayName(position);
    return label === position ? prettifySlug(position) : label;
  };

  const keywordsOf = (position: string): string | null | undefined =>
    language === "fr"
      ? positionMeta.get(position)?.keywords
      : positionMeta.get(position)?.keywordsEn;

  return (
    <div className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
      {/* Desktop : tableau complet. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-nuffle-bronze/20 text-left text-xs font-subtitle uppercase tracking-wide text-nuffle-bronze/70">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Joueur</th>
              <th className="px-4 py-3">Poste</th>
              <th className="px-3 py-3 text-center">Coût</th>
              <th className="px-3 py-3 text-center">MA</th>
              <th className="px-3 py-3 text-center">ST</th>
              <th className="px-3 py-3 text-center">AG</th>
              <th className="px-3 py-3 text-center">PA</th>
              <th className="px-3 py-3 text-center">AV</th>
              <th className="px-4 py-3">Compétences</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-nuffle-bronze/10 last:border-0 align-top">
                <td className="px-4 py-2.5 font-score text-lg text-nuffle-bronze">{p.number}</td>
                <td className="px-4 py-2.5 font-subtitle font-semibold text-nuffle-anthracite">
                  <span className="inline-flex items-center gap-2">
                    <PlayerAvatar name={p.name} imageUrl={p.imageUrl} size={24} />
                    {p.name}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-nuffle-anthracite/75">
                  <div>{positionLabel(p.position)}</div>
                  <KeywordChips keywords={keywordsOf(p.position)} className="mt-1" />
                </td>
                <td
                  className="px-3 py-2.5 text-center font-score text-nuffle-bronze whitespace-nowrap"
                  data-testid={`public-player-value-${p.number}`}
                >
                  {formatKpo(playerValuePo(p))}
                </td>
                <td className="px-3 py-2.5 text-center text-nuffle-anthracite/75">{p.ma}</td>
                <td className="px-3 py-2.5 text-center text-nuffle-anthracite/75">{p.st}</td>
                <td className="px-3 py-2.5 text-center text-nuffle-anthracite/75">{formatPlusStat(p.ag)}</td>
                <td className="px-3 py-2.5 text-center text-nuffle-anthracite/75">{formatPlusStat(p.pa)}</td>
                <td className="px-3 py-2.5 text-center text-nuffle-anthracite/75">{formatPlusStat(p.av)}</td>
                <td className="px-4 py-2.5">
                  <SkillTooltip
                    ruleset={ruleset}
                    skillsString={skillsOf(p)}
                    teamName={rosterSlug}
                    position={p.position}
                    dbBaseSkills={positionMeta.get(p.position)?.baseSkills}
                  />
                  <SkillAccessBadges
                    primary={skillAccess.get(p.position)?.primary ?? null}
                    secondary={skillAccess.get(p.position)?.secondary ?? null}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile : une carte par joueur — un lien partagé s'ouvre surtout
          au téléphone, un tableau à 10 colonnes y est illisible. */}
      <ul className="md:hidden divide-y divide-nuffle-bronze/10">
        {sorted.map((p) => (
          <li key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="font-score text-lg text-nuffle-bronze leading-none pt-0.5">{p.number}</span>
                <PlayerAvatar name={p.name} imageUrl={p.imageUrl} size={28} />
                <div className="min-w-0">
                  <div className="font-subtitle font-semibold text-nuffle-anthracite truncate">{p.name}</div>
                  <div className="text-xs text-nuffle-anthracite/70">{positionLabel(p.position)}</div>
                  <KeywordChips keywords={keywordsOf(p.position)} className="mt-1" />
                </div>
              </div>
              <span className="shrink-0 font-score text-nuffle-bronze whitespace-nowrap">
                {formatKpo(playerValuePo(p))}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-5 gap-1 text-center">
              {[
                { label: "MA", value: String(p.ma) },
                { label: "ST", value: String(p.st) },
                { label: "AG", value: formatPlusStat(p.ag) },
                { label: "PA", value: formatPlusStat(p.pa) },
                { label: "AV", value: formatPlusStat(p.av) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-white/60 border border-nuffle-bronze/15 py-1">
                  <dt className="text-[10px] font-subtitle uppercase tracking-wider text-nuffle-anthracite/55">
                    {stat.label}
                  </dt>
                  <dd className="font-score text-sm text-nuffle-anthracite">{stat.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-3">
              <SkillTooltip
                ruleset={ruleset}
                skillsString={skillsOf(p)}
                teamName={rosterSlug}
                position={p.position}
                dbBaseSkills={positionMeta.get(p.position)?.baseSkills}
              />
              <SkillAccessBadges
                primary={skillAccess.get(p.position)?.primary ?? null}
                secondary={skillAccess.get(p.position)?.secondary ?? null}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
