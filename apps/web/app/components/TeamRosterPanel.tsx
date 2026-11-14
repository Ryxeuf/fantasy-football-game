"use client";

import type { ReactNode } from "react";
import TeamLogo from "./TeamLogo";
import SkillTooltip from "../me/teams/components/SkillTooltip";
import SkillAccessBadges from "../me/teams/components/SkillAccessBadges";
import KeywordChips from "./KeywordChips";
import PlayerAvatar from "./PlayerAvatar";
import SpecialRulesBadges, { type SpecialRuleView } from "./SpecialRulesBadges";
import RosterPlayerCard from "./roster-panel/RosterPlayerCard";
import { useRosterPositionMeta } from "./roster-panel/useRosterPositionMeta";
import {
  formatGold,
  formatTarget,
  hasTeamPlayerCard,
  playerValueLabel,
  rosterStatCells,
  rosterStatTestId,
} from "./roster-panel/roster-player-view";
import {
  PlayerAvailability,
  PlayerCardButtons,
  PlayerDeathMark,
  PlayerInjuries,
  PlayerNoteBadge,
  RemoveDeadButton,
} from "./roster-panel/RosterPlayerParts";

/**
 * Fiche de roster en LECTURE SEULE, partagée par la ligue
 * (`/leagues/[id]/teams/[teamId]`) et la coupe (`/cups/[id]/teams/[teamId]`).
 *
 * Une seule mise en page pour les deux compétitions : la coupe ne fait que
 * RETIRER ce qui n'y existe pas (trésorerie, blessures durables,
 * disponibilité — une coupe rejoue son roster d'inscription intact à chaque
 * rencontre). Les `data-testid` historiques de la ligue sont conservés.
 */

export interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  positionName?: string;
  /** `null` : Star Player du roster d'inscription d'une coupe (sans numéro). */
  number: number | null;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  /**
   * `TeamPlayer.advancements` brut — signale d'un dé les compétences tirées
   * au hasard. Optionnel : rétro-compat API.
   */
  advancements?: string | null;
  spp: number;
  dead: boolean;
  /** FR20 — stats + blessures durables + dispo (optionnels : rétro-compat API). */
  totalTouchdowns?: number;
  totalCasualties?: number;
  totalCompletions?: number;
  totalInterceptions?: number;
  aggressions?: number;
  matchesPlayed?: number;
  missNextMatch?: boolean;
  nigglingInjuries?: number;
  statReductions?: {
    ma: number;
    st: number;
    ag: number;
    pa: number;
    av: number;
  };
  /**
   * Valeur du joueur en po (coût du poste + surcoût des améliorations),
   * même règle que la VE d'équipe. Optionnel : rétro-compat API.
   */
  value?: number;
  /** Provenance du statut mort/licencié (optionnels : rétro-compat API). */
  statusAt?: string | null;
  statusSource?: string | null;
  /** Photo uploadée par le coach (miniature ; null => initiales). */
  imageUrl?: string | null;
  /** Mention (« Star Player »). Optionnel : seule la coupe en sert. */
  note?: string | null;
}

export interface RosterTeam {
  id: string;
  name: string;
  roster: string;
  /** Édition de l'équipe (catalogue de compétences, accès). Optionnel : rétro-compat API. */
  ruleset?: string;
  raceName: string;
  coachName: string | null;
  /** Absente en coupe (pas de trésorerie en tournoi résurrection). */
  treasury?: number;
  teamValue: number;
  currentValue: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  /** Logo uploadé par le coach (null => logo dérivé du roster). */
  logoUrl?: string | null;
  /** A11 — règles spéciales d'équipe (certaines impactent les PSP). */
  specialRules?: SpecialRuleView[];
  /**
   * A11 — type de ligue (ligues régionales). A159 : le serveur ne sert que
   * la Ligue RETENUE par l'équipe (toutes pour une équipe sans choix).
   */
  regionalLeagues?: Array<{ slug: string; name: string }>;
  /** A159 — slug de la Ligue retenue à la création (optionnel : rétro-compat API). */
  regionalLeague?: string | null;
  /** Coupe : rencontres jouées dans la coupe. */
  cupMatchesPlayed?: number;
}

export { formatGold };

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-sm font-semibold text-nuffle-anthracite tabular-nums">
        {value}
      </div>
    </div>
  );
}

export interface TeamRosterPanelProps {
  team: RosterTeam;
  players: RosterPlayer[];
  /** Ligue (défaut) ou coupe : la coupe retire trésorerie, blessures, dispo. */
  competition?: "league" | "cup";
  testId: string;
  /** Commissaire de ligue : bouton « Retirer » sur les morts. */
  canRemoveDead?: boolean;
  removingPlayerId?: string | null;
  onRemoveDeadPlayer?: (player: RosterPlayer) => void;
  /** Sous l'en-tête : bandeau propre à la compétition (roster d'inscription…). */
  notice?: ReactNode;
  /** Sous le tableau : sections propres à la compétition (coups de pouce…). */
  children?: ReactNode;
}

export default function TeamRosterPanel({
  team,
  players,
  competition = "league",
  testId,
  canRemoveDead = false,
  removingPlayerId = null,
  onRemoveDeadPlayer,
  notice,
  children,
}: TeamRosterPanelProps) {
  const isCup = competition === "cup";
  // Une coupe rejoue son roster d'inscription intact : ni blessure durable,
  // ni absence, ni mort ne s'y conservent.
  const showInjuries = !isCup;
  // Mots-clés, accès aux compétences, compétences de base et illustration
  // des postes : même source que la fiche « Mes équipes ».
  const positionMeta = useRosterPositionMeta(team.roster, team.ruleset);
  // En-têtes de stats : mêmes cellules que chaque ligne (titres ligue/coupe).
  const statHeaders = rosterStatCells(
    { dead: false, spp: 0 },
    competition,
  );

  return (
    <div data-testid={testId} className="mt-4 space-y-5">
      {/* En-tête équipe */}
      <header className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <TeamLogo
          slug={team.roster}
          logoUrl={team.logoUrl ?? null}
          size={56}
          title={team.name}
        />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-nuffle-anthracite">
            {team.name}
          </h1>
          <p className="text-sm text-gray-600">
            {team.raceName}
            {team.coachName ? ` • Coach ${team.coachName}` : ""}
          </p>
        </div>
      </header>

      {notice}

      {/* Stats clés */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Valeur d'équipe" value={formatGold(team.teamValue)} />
        <StatCard
          label="VEA (actuelle)"
          value={formatGold(team.currentValue)}
        />
        {isCup ? (
          <StatCard
            label="Matchs de coupe"
            value={String(team.cupMatchesPlayed ?? 0)}
          />
        ) : (
          <StatCard label="Trésorerie" value={formatGold(team.treasury ?? 0)} />
        )}
        <StatCard label="Joueurs" value={String(players.length)} />
      </section>

      {/* Staff & relances */}
      <section className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          Relances : <strong>{team.rerolls}</strong>
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          Pom-pom girls : <strong>{team.cheerleaders}</strong>
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          Assistants : <strong>{team.assistants}</strong>
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          Apothicaire : <strong>{team.apothecary ? "oui" : "non"}</strong>
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          Fans dévoués : <strong>{team.dedicatedFans}</strong>
        </span>
      </section>

      {/* A11 — règles spéciales + type de ligue (impactent parfois les
          PSP, ex. Bagarreurs Brutaux : TD 2 PSP / élimination 3 PSP). */}
      <section
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
        data-testid="league-roster-special-rules"
      >
        <SpecialRulesBadges rules={team.specialRules ?? []} withLabel />
        {team.regionalLeagues && team.regionalLeagues.length > 0 ? (
          <span className="inline-flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs text-gray-500">Type de ligue :</span>
            {team.regionalLeagues.map((l) => (
              <span
                key={l.slug}
                className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200"
              >
                {l.name}
              </span>
            ))}
          </span>
        ) : null}
      </section>

      {/* Roster — tableau sur écran large, cartes sur écran étroit (même
          contenu, cf. roster-panel/roster-player-view). */}
      <section
        data-testid="roster-table"
        className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white xl:block"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="whitespace-nowrap bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-2 py-2 text-left">N°</th>
                <th className="px-2 py-2 text-left">Nom</th>
                <th className="px-2 py-2 text-left">Poste</th>
                <th className="px-2 py-2 text-right">MA</th>
                <th className="px-2 py-2 text-right">ST</th>
                <th className="px-2 py-2 text-right">AG</th>
                <th className="px-2 py-2 text-right">PA</th>
                <th className="px-2 py-2 text-right">AV</th>
                <th className="px-2 py-2 text-left">Compétences</th>
                {statHeaders.map((h) => (
                  <th key={h.key} className="px-2 py-2 text-right" title={h.title}>
                    {h.label}
                  </th>
                ))}
                <th
                  className="px-2 py-2 text-right"
                  title="Valeur du joueur (coût du poste + améliorations)"
                >
                  Valeur
                </th>
                {showInjuries ? (
                  <>
                    <th
                      className="px-2 py-2 text-left"
                      title="Blessures durables : BP = Blessure Persistante (cumulable), plus les réductions de caractéristique (Séquelles)"
                    >
                      Blessures
                    </th>
                    <th className="px-2 py-2 text-center" title="Disponible pour le prochain match">Dispo</th>
                  </>
                ) : null}
                <th
                  className="px-2 py-2 text-left"
                  title="Carte du joueur (PNG) ; le commissaire retire ici un joueur mort (sans licenciement)"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const posMeta = positionMeta.metaByPosition.get(p.position);
                const access = positionMeta.accessByPosition.get(p.position);
                const positionName = p.positionName ?? posMeta?.displayName ?? p.position;
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-gray-100 align-top ${
                      p.dead ? "text-gray-400" : "hover:bg-slate-50/60"
                    }`}
                  >
                    <td className="px-2 py-2 tabular-nums text-gray-500">
                      {p.number ?? "—"}
                    </td>
                    <td className="min-w-[11rem] px-2 py-2 font-medium text-nuffle-anthracite">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <PlayerAvatar
                          name={p.name}
                          imageUrl={p.imageUrl}
                          size={24}
                        />
                        <span
                          className={`whitespace-nowrap ${p.dead ? "text-gray-400 line-through" : ""}`}
                        >
                          {p.name}
                        </span>
                        <PlayerNoteBadge playerId={p.id} note={p.note} variant="table" />
                        <PlayerDeathMark player={p} playerId={p.id} variant="table" />
                      </span>
                    </td>
                    <td className="px-2 py-2 text-gray-600">
                      <div>{positionName}</div>
                      <KeywordChips keywords={posMeta?.keywords} className="mt-1" />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.ma}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.st}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatTarget(p.ag)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatTarget(p.pa)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatTarget(p.av)}</td>
                    <td className="min-w-[10rem] px-2 py-2">
                      <SkillTooltip
                        skillsString={p.skills}
                        position={p.position}
                        teamName={team.roster}
                        ruleset={team.ruleset}
                        useDirectParsing
                        dbBaseSkills={posMeta?.baseSkills}
                        advancements={p.advancements}
                      />
                      <SkillAccessBadges
                        primary={access?.primary ?? null}
                        secondary={access?.secondary ?? null}
                      />
                    </td>
                    {rosterStatCells(p, competition).map((cell) => (
                      <td
                        key={cell.key}
                        className="px-2 py-2 text-right tabular-nums"
                        data-testid={rosterStatTestId(cell.key, p.id, "table")}
                      >
                        {cell.value}
                      </td>
                    ))}
                    <td
                      className="whitespace-nowrap px-2 py-2 text-right tabular-nums"
                      data-testid={`player-value-${p.id}`}
                    >
                      {playerValueLabel(p.value)}
                    </td>
                    {showInjuries ? (
                      <>
                        <td className="px-2 py-2">
                          <PlayerInjuries player={p} playerId={p.id} variant="table" />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <PlayerAvailability player={p} playerId={p.id} variant="table" />
                        </td>
                      </>
                    ) : null}
                    <td className="px-2 py-2">
                      <div className="flex flex-col items-start gap-1.5">
                        {hasTeamPlayerCard(p) ? (
                          <PlayerCardButtons
                            playerId={p.id}
                            player={p}
                            context={{
                              teamName: team.name,
                              rosterSlug: team.roster,
                              positionName,
                              positionImageUrl: posMeta?.imageUrl ?? null,
                            }}
                            variant="table"
                          />
                        ) : null}
                        {canRemoveDead && p.dead ? (
                          <RemoveDeadButton
                            playerId={p.id}
                            removing={removingPlayerId === p.id}
                            onClick={() => onRemoveDeadPlayer?.(p)}
                            variant="table"
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section
        data-testid="roster-cards"
        aria-label="Composition de l'équipe"
        className="grid gap-3 md:grid-cols-2 xl:hidden"
      >
        {players.map((p) => (
          <RosterPlayerCard
            key={p.id}
            player={p}
            competition={competition}
            teamName={team.name}
            rosterSlug={team.roster}
            ruleset={team.ruleset}
            positionMeta={positionMeta.metaByPosition.get(p.position)}
            skillAccess={positionMeta.accessByPosition.get(p.position)}
            showInjuries={showInjuries}
            canRemoveDead={canRemoveDead}
            removing={removingPlayerId === p.id}
            onRemoveDead={() => onRemoveDeadPlayer?.(p)}
          />
        ))}
      </section>

      {children}
    </div>
  );
}
