"use client";

import type { ReactNode } from "react";
import TeamLogo from "./TeamLogo";
import SkillTooltip from "../me/teams/components/SkillTooltip";
import PlayerAvatar from "./PlayerAvatar";
import SpecialRulesBadges, { type SpecialRuleView } from "./SpecialRulesBadges";

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

/**
 * Origine lisible d'une mort. Sert à expliquer le ☠ : une mort issue d'une
 * feuille de match est réversible en invalidant la feuille, une mort posée
 * à la main ne l'est pas de la même façon.
 */
const STATUS_SOURCE_LABELS: Record<string, string> = {
  match_sheet: "feuille de match",
  online_match: "match en ligne",
  commissioner: "décision du commissaire",
  admin: "administration",
  legacy: "origine inconnue",
};

function deathOriginLabel(p: RosterPlayer): string {
  if (!p.dead) return "";
  const source = p.statusSource
    ? (STATUS_SOURCE_LABELS[p.statusSource] ?? p.statusSource)
    : null;
  const when = p.statusAt
    ? new Date(p.statusAt).toLocaleDateString("fr-FR")
    : null;
  if (source && when) return `Décédé — ${source}, le ${when}`;
  if (source) return `Décédé — ${source}`;
  return "Décédé";
}

/**
 * FR20 — libellé compact des blessures durables d'un joueur.
 *
 * Les Blessures Persistantes sont notées « N BP » (abréviation officielle
 * de la feuille d'équipe) et se **cumulent** : le compteur serveur est
 * incrémenté à chaque nouvelle BP, on affiche donc le total tel quel
 * (« 1 BP », « 2 BP », …) sans pluriel — « BP » est un sigle invariable.
 * Les réductions de caractéristique (Séquelles) restent affichées à part.
 */
function lastingInjuriesLabel(p: RosterPlayer): string {
  const parts: string[] = [];
  const r = p.statReductions;
  if (r) {
    if (r.ma > 0) parts.push(`-${r.ma} M`);
    if (r.st > 0) parts.push(`-${r.st} F`);
    if (r.ag > 0) parts.push(`+${r.ag} AG`);
    if (r.pa > 0) parts.push(`+${r.pa} CP`);
    if (r.av > 0) parts.push(`-${r.av} AR`);
  }
  const bp = p.nigglingInjuries ?? 0;
  if (bp > 0) parts.push(`${bp} BP`);
  return parts.join(", ");
}

export function formatGold(n: number): string {
  return `${n.toLocaleString("fr-FR")} po`;
}

/**
 * Valeur d'un joueur en kpo (105 000 -> « 105 k po ») : la colonne
 * « Valeur » du roster (17 colonnes) reste compacte.
 */
function formatKpo(n: number): string {
  return `${Math.round(n / 1000).toLocaleString("fr-FR")} k po`;
}

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

      {/* Roster */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
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
                <th
                  className="px-2 py-2 text-right"
                  title={
                    isCup
                      ? "Matchs joués dans la coupe"
                      : "Matchs joués, toutes compétitions (ligue, coupe, en ligne)"
                  }
                >
                  MJ
                </th>
                <th className="px-2 py-2 text-right" title="Touchdowns marqués">TD</th>
                <th className="px-2 py-2 text-right" title="Éliminations provoquées sur Blocage">Élim.</th>
                <th className="px-2 py-2 text-right" title="Passes complétées">Pas.</th>
                <th className="px-2 py-2 text-right" title="Interceptions">Int.</th>
                <th className="px-2 py-2 text-right" title="Agressions">Agr.</th>
                <th
                  className="px-2 py-2 text-right"
                  title={
                    isCup
                      ? "Points de Star Player à l'inscription (une coupe n'en rapporte pas)"
                      : "Points de Star Player gagnés"
                  }
                >
                  PSP
                </th>
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
                {canRemoveDead ? (
                  <th
                    className="px-2 py-2 text-center"
                    title="Retirer un joueur mort du roster (sans licenciement)"
                  >
                    {""}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const injuries = lastingInjuriesLabel(p);
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-gray-100 ${
                      p.dead
                        ? "text-gray-400 line-through"
                        : "hover:bg-slate-50/60"
                    }`}
                  >
                    <td className="px-2 py-2 tabular-nums text-gray-500">
                      {p.number ?? "—"}
                    </td>
                    <td className="px-2 py-2 font-medium text-nuffle-anthracite">
                      <span className="inline-flex items-center gap-1.5">
                        <PlayerAvatar
                          name={p.name}
                          imageUrl={p.imageUrl}
                          size={24}
                        />
                        {p.name}
                        {p.note ? (
                          <span
                            data-testid={`player-note-${p.id}`}
                            className="rounded bg-nuffle-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-nuffle-bronze"
                          >
                            {p.note}
                          </span>
                        ) : null}
                        {p.dead ? (
                          <span
                            title={deathOriginLabel(p)}
                            data-testid={`player-death-origin-${p.id}`}
                          >
                            {" ☠"}
                          </span>
                        ) : (
                          ""
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-gray-600">
                      {p.positionName ?? p.position}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.ma}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.st}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.ag}+</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {p.pa === null ? "–" : `${p.pa}+`}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.av}+</td>
                    <td className="px-2 py-2">
                      <SkillTooltip
                        skillsString={p.skills}
                        position={p.position}
                        useDirectParsing
                      />
                    </td>
                    <td
                      className="px-2 py-2 text-right tabular-nums"
                      data-testid={`player-matches-${p.id}`}
                    >
                      {p.matchesPlayed ?? 0}
                    </td>
                    <td
                      className="px-2 py-2 text-right tabular-nums"
                      data-testid={`player-td-${p.id}`}
                    >
                      {p.totalTouchdowns ?? 0}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {p.totalCasualties ?? 0}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {p.totalCompletions ?? 0}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {p.totalInterceptions ?? 0}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {p.aggressions ?? 0}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.spp}</td>
                    <td
                      className="px-2 py-2 text-right tabular-nums"
                      data-testid={`player-value-${p.id}`}
                    >
                      {typeof p.value === "number" ? formatKpo(p.value) : "—"}
                    </td>
                    {showInjuries ? (
                      <>
                        <td
                          className="px-2 py-2 text-xs text-red-700"
                          data-testid={`player-injuries-${p.id}`}
                        >
                          {injuries || <span className="text-gray-300">—</span>}
                        </td>
                        <td
                          className="px-2 py-2 text-center"
                          data-testid={`player-availability-${p.id}`}
                        >
                          {p.dead ? (
                            <span title={deathOriginLabel(p)}>☠</span>
                          ) : p.missNextMatch ? (
                            <span
                              className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700"
                              title="Rate le prochain match (blessure)"
                            >
                              Absent
                            </span>
                          ) : (
                            <span
                              className="text-emerald-600"
                              title="Disponible pour le prochain match"
                            >
                              ✓
                            </span>
                          )}
                        </td>
                      </>
                    ) : null}
                    {canRemoveDead ? (
                      <td className="px-2 py-2 text-center">
                        {p.dead ? (
                          <button
                            type="button"
                            data-testid={`remove-dead-player-${p.id}`}
                            disabled={removingPlayerId === p.id}
                            onClick={() => onRemoveDeadPlayer?.(p)}
                            title="Retirer ce joueur mort du roster (fiche et historique conservés, aucun licenciement)"
                            className="whitespace-nowrap rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 no-underline hover:bg-red-50 disabled:opacity-50"
                          >
                            {removingPlayerId === p.id ? "…" : "Retirer"}
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {children}
    </div>
  );
}
