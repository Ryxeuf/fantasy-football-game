"use client";

/**
 * Page detail matchup — repond a "comment / pourquoi j'ai gagne / perdu".
 *
 *   - Bandeau score avec winner badge + week + outcome
 *   - 2 colonnes home / away avec starters tries par finalSpp desc
 *   - Chaque starter : C/V badge, race, nom + lien fiche, position,
 *     rawSpp + bonus captain = finalSpp
 *   - Section expandable par joueur : events SPP detailles + bonus de
 *     skill BB
 *   - Sommaire decision : top contributors, captain impact, gazette
 *
 * Mobile-first : sm:grid-cols-2 pour le side-by-side, stacked sinon.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../../lib/api-client";
import { RaceIcon } from "../../../../RaceIcon";

interface SppEventDto {
  type: "TD" | "CP" | "DP" | "CAS" | "MALUS";
  count: number;
  spp: number;
  reason: string;
}

interface SkillBonusDto {
  skill: string;
  count: number;
  spp: number;
  reason: string;
}

interface StarterDetail {
  starterId: string;
  playerId: string;
  pseudonym: string;
  teamCode: string | null;
  nflPosition: string;
  bbPosition: string;
  raceLabel: string | null;
  bbRace: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  rawSpp: number | null;
  finalSpp: number | null;
  captainBonus: number;
  events: SppEventDto[];
  skillBonuses: SkillBonusDto[];
  rawStats: Record<string, unknown> | null;
}

interface SideDetail {
  entryId: string;
  teamName: string;
  lineupId: string | null;
  totalSpp: number;
  topScorerId: string | null;
  starters: StarterDetail[];
}

interface MatchupDetail {
  matchupId: string;
  leagueId: string;
  weekId: string;
  weekNumber: number | null;
  isPlayoffs: boolean;
  settledAt: string | null;
  outcome: "home-win" | "away-win" | "tie" | "pending";
  margin: number | null;
  winnerEntryId: string | null;
  home: SideDetail;
  away: SideDetail;
  gazette: {
    title: string;
    body: string;
    generatedAt: string;
  } | null;
}

interface MeResponse {
  user?: { id?: string } | null;
}

const EVENT_TYPE_LABEL: Readonly<Record<SppEventDto["type"], string>> = {
  TD: "Touchdown",
  CP: "Passe complète",
  DP: "Pass défensif",
  CAS: "Casualty",
  MALUS: "Malus",
};

const EVENT_TYPE_COLOR: Readonly<Record<SppEventDto["type"], string>> = {
  TD: "bg-emerald-100 text-emerald-800 border-emerald-300",
  CP: "bg-sky-100 text-sky-800 border-sky-300",
  DP: "bg-indigo-100 text-indigo-800 border-indigo-300",
  CAS: "bg-red-100 text-red-800 border-red-300",
  MALUS: "bg-amber-100 text-amber-800 border-amber-300",
};

export default function MatchupDetailPage(): JSX.Element {
  const params = useParams<{ id: string; matchupId: string }>();
  const leagueId = params?.id;
  const matchupId = params?.matchupId;

  const [detail, setDetail] = useState<MatchupDetail | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!leagueId || !matchupId) return;
    try {
      const [d, me] = await Promise.all([
        apiRequest<MatchupDetail>(
          `/api/nfl-fantasy/leagues/${leagueId}/matchups/${matchupId}`,
        ),
        apiRequest<MeResponse>("/auth/me").catch(
          () => ({ user: null }) as MeResponse,
        ),
      ]);
      setDetail(d);
      setMyUserId(me.user?.id ?? null);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError({ message: err.message, status: err.status });
      } else {
        setError({
          message: err instanceof Error ? err.message : "Erreur",
        });
      }
    }
  }, [leagueId, matchupId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ────────── Rendu erreurs / loading ──────────

  if (error?.status === 401) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-nuffle-anthracite"
        >
          Se connecter
        </Link>
      </div>
    );
  }
  if (error?.status === 404) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Matchup introuvable</h1>
        <Link
          href={`/nfl-fantasy/leagues/${leagueId}/matchups`}
          className="mt-4 inline-block text-sm text-nuffle-gold"
        >
          ← Retour matchups
        </Link>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        Erreur : {error.message}
      </div>
    );
  }
  if (!detail) {
    return <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>;
  }

  return (
    <MatchupDetailContent
      detail={detail}
      myUserId={myUserId}
      expanded={expanded}
      toggleExpanded={(id) => {
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      }}
      leagueId={leagueId!}
    />
  );
}

// ────────────────────────────────────────────────────────────────────
// Contenu principal — sous-composant pour clarte
// ────────────────────────────────────────────────────────────────────

function MatchupDetailContent({
  detail,
  myUserId: _myUserId,
  expanded,
  toggleExpanded,
  leagueId,
}: {
  detail: MatchupDetail;
  myUserId: string | null;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  leagueId: string;
}): JSX.Element {
  const settled = detail.outcome !== "pending";
  const homeIsWinner = detail.outcome === "home-win";
  const awayIsWinner = detail.outcome === "away-win";
  const homeScore = settled
    ? Math.round(detail.home.totalSpp).toString()
    : "—";
  const awayScore = settled
    ? Math.round(detail.away.totalSpp).toString()
    : "—";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/nfl-fantasy/leagues/${leagueId}/matchups`}
            className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
          >
            ← Matchups
          </Link>
          <Link
            href="/nfl-fantasy/rules"
            className="text-xs text-nuffle-bronze hover:underline"
          >
            📖 Règles de calcul des SPP
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-semibold">
          Détail du match — Semaine {detail.weekNumber ?? "?"}
          {detail.isPlayoffs && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              🏆 Playoff
            </span>
          )}
        </h1>
      </div>

      {/* Bandeau score ──────────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-nuffle-bronze/30 bg-white">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4">
          <div className="min-w-0 text-left">
            <p className="text-xs uppercase tracking-wide text-nuffle-anthracite/60">
              Domicile
            </p>
            <p
              className={`mt-1 truncate text-lg font-semibold ${
                homeIsWinner ? "text-emerald-700" : "text-nuffle-anthracite"
              }`}
            >
              {homeIsWinner && "🏆 "}
              {detail.home.teamName}
            </p>
          </div>
          <div className="px-2 text-center font-mono text-2xl text-nuffle-anthracite sm:text-3xl">
            {homeScore}
            <span className="mx-2 text-nuffle-anthracite/40">–</span>
            {awayScore}
          </div>
          <div className="min-w-0 text-right">
            <p className="text-xs uppercase tracking-wide text-nuffle-anthracite/60">
              Extérieur
            </p>
            <p
              className={`mt-1 truncate text-lg font-semibold ${
                awayIsWinner ? "text-emerald-700" : "text-nuffle-anthracite"
              }`}
            >
              {detail.away.teamName}
              {awayIsWinner && " 🏆"}
            </p>
          </div>
        </div>
        <div className="border-t border-nuffle-bronze/20 bg-nuffle-ivory/40 px-4 py-2 text-center text-xs text-nuffle-anthracite/70">
          {settled ? (
            <>
              {detail.outcome === "tie" ? (
                <>Match nul — settled le </>
              ) : (
                <>
                  Écart : <strong>{Math.abs(detail.margin ?? 0)} SPP</strong>
                  {" — settled le "}
                </>
              )}
              {new Date(detail.settledAt!).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </>
          ) : (
            <>Match non encore réglé — affichage des compositions prévues</>
          )}
        </div>
      </section>

      {/* Gazette narrative (si disponible) ──────────── */}
      {detail.gazette && (
        <section
          className="rounded-lg border border-nuffle-gold/40 bg-nuffle-gold/5 p-4"
          data-testid="matchup-gazette"
        >
          <h2 className="text-base font-semibold text-nuffle-anthracite">
            📜 {detail.gazette.title}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-nuffle-anthracite/90">
            {detail.gazette.body}
          </p>
        </section>
      )}

      {/* Sommaire decision (settled only) ──────────── */}
      {settled && (
        <DecisionSummary detail={detail} />
      )}

      {/* Side-by-side lineups ──────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SideColumn
          side={detail.home}
          label="Domicile"
          isWinner={homeIsWinner}
          settled={settled}
          expanded={expanded}
          toggleExpanded={toggleExpanded}
        />
        <SideColumn
          side={detail.away}
          label="Extérieur"
          isWinner={awayIsWinner}
          settled={settled}
          expanded={expanded}
          toggleExpanded={toggleExpanded}
        />
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sommaire decision : top scorer, captain impact, plus gros flop
// ────────────────────────────────────────────────────────────────────

function DecisionSummary({ detail }: { detail: MatchupDetail }): JSX.Element {
  const homeTop = detail.home.starters[0] ?? null;
  const awayTop = detail.away.starters[0] ?? null;
  const homeFlop = findFlop(detail.home);
  const awayFlop = findFlop(detail.away);
  const homeCaptainBonus = sumCaptainBonus(detail.home);
  const awayCaptainBonus = sumCaptainBonus(detail.away);

  return (
    <section className="rounded-lg border border-nuffle-bronze/20 bg-white p-4">
      <h2 className="text-base font-semibold text-nuffle-anthracite">
        🔍 Pourquoi ce résultat
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryCard
          title="Top performer 🏟️"
          rows={[
            homeTop
              ? {
                  side: detail.home.teamName,
                  player: homeTop.pseudonym,
                  spp: homeTop.finalSpp ?? 0,
                }
              : null,
            awayTop
              ? {
                  side: detail.away.teamName,
                  player: awayTop.pseudonym,
                  spp: awayTop.finalSpp ?? 0,
                }
              : null,
          ]}
        />
        <SummaryCard
          title="Apport du captain 👑"
          subtitle="Gain SPP grâce au ×1.5 / ×1.2"
          rows={[
            { side: detail.home.teamName, value: `+${homeCaptainBonus} SPP` },
            { side: detail.away.teamName, value: `+${awayCaptainBonus} SPP` },
          ]}
        />
        {(homeFlop || awayFlop) && (
          <SummaryCard
            title="Choix décevant 🪦"
            subtitle="Starter le plus bas / négatif"
            rows={[
              homeFlop
                ? {
                    side: detail.home.teamName,
                    player: homeFlop.pseudonym,
                    spp: homeFlop.finalSpp ?? 0,
                  }
                : null,
              awayFlop
                ? {
                    side: detail.away.teamName,
                    player: awayFlop.pseudonym,
                    spp: awayFlop.finalSpp ?? 0,
                  }
                : null,
            ]}
          />
        )}
        <SummaryCard
          title="Score total"
          rows={[
            {
              side: detail.home.teamName,
              value: `${detail.home.totalSpp} SPP`,
            },
            {
              side: detail.away.teamName,
              value: `${detail.away.totalSpp} SPP`,
            },
          ]}
        />
      </div>
    </section>
  );
}

interface SummaryRow {
  side: string;
  player?: string;
  spp?: number;
  value?: string;
}

function SummaryCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: ReadonlyArray<SummaryRow | null>;
}): JSX.Element {
  return (
    <div className="rounded-md border border-nuffle-bronze/20 bg-nuffle-ivory/40 p-3">
      <p className="text-sm font-semibold text-nuffle-anthracite">{title}</p>
      {subtitle && (
        <p className="text-[11px] text-nuffle-anthracite/60">{subtitle}</p>
      )}
      <ul className="mt-2 space-y-1 text-xs">
        {rows.filter((r): r is SummaryRow => r !== null).map((r, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate text-nuffle-anthracite/70">{r.side}</span>
            <span className="font-mono font-semibold text-nuffle-anthracite">
              {r.player ? `${r.player} — ` : ""}
              {r.value ?? `${r.spp} SPP`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function sumCaptainBonus(side: SideDetail): number {
  return side.starters.reduce((acc, s) => acc + s.captainBonus, 0);
}

function findFlop(side: SideDetail): StarterDetail | null {
  // Le moins bon des starters score, en privilegiant les valeurs negatives
  if (side.starters.length === 0) return null;
  const sorted = [...side.starters].sort(
    (a, b) => (a.finalSpp ?? 0) - (b.finalSpp ?? 0),
  );
  const bottom = sorted[0];
  if ((bottom.finalSpp ?? 0) >= 3) return null; // pas vraiment un flop
  return bottom;
}

// ────────────────────────────────────────────────────────────────────
// Colonne d'une side avec ses starters
// ────────────────────────────────────────────────────────────────────

function SideColumn({
  side,
  label,
  isWinner,
  settled,
  expanded,
  toggleExpanded,
}: {
  side: SideDetail;
  label: string;
  isWinner: boolean;
  settled: boolean;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
}): JSX.Element {
  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        isWinner
          ? "border-emerald-400 bg-emerald-50/40"
          : "border-nuffle-bronze/20 bg-white"
      }`}
      data-testid={`matchup-side-${side.entryId}`}
    >
      <header className="border-b border-nuffle-bronze/20 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-nuffle-anthracite/60">
          {label}
          {isWinner && (
            <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
              Vainqueur
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate text-base font-semibold text-nuffle-anthracite">
          {side.teamName}
        </p>
        {settled && (
          <p className="mt-1 font-mono text-sm text-nuffle-anthracite/80">
            Total : <strong>{side.totalSpp} SPP</strong>
          </p>
        )}
      </header>

      {side.starters.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-nuffle-anthracite/60">
          Aucun lineup enregistré pour cette semaine.
        </p>
      ) : (
        <ul className="divide-y divide-nuffle-bronze/15">
          {side.starters.map((s) => (
            <StarterRow
              key={s.starterId}
              starter={s}
              settled={settled}
              isExpanded={expanded.has(s.starterId)}
              onToggle={() => toggleExpanded(s.starterId)}
              isTopScorer={s.starterId === side.topScorerId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Ligne joueur + expand pour breakdown SPP
// ────────────────────────────────────────────────────────────────────

function StarterRow({
  starter,
  settled,
  isExpanded,
  onToggle,
  isTopScorer,
}: {
  starter: StarterDetail;
  settled: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isTopScorer: boolean;
}): JSX.Element {
  const hasBreakdown =
    starter.events.length > 0 || starter.skillBonuses.length > 0;
  const sppDisplay = settled
    ? `${starter.finalSpp ?? 0} SPP`
    : "—";

  return (
    <li
      className={`min-w-0 px-4 py-2.5 ${isTopScorer ? "bg-amber-50/40" : ""}`}
      data-testid={`starter-row-${starter.playerId}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {starter.isCaptain && (
          <span
            className="shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-950"
            title="Captain ×1.5"
          >
            👑 C
          </span>
        )}
        {starter.isViceCaptain && (
          <span
            className="shrink-0 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-50"
            title="Vice ×1.2"
          >
            🥈 V
          </span>
        )}
        <RaceIcon
          race={starter.bbRace}
          label={starter.raceLabel}
          className="shrink-0 text-base leading-none"
        />
        <Link
          href={`/nfl-fantasy/players/${starter.playerId}`}
          className="block min-w-0 flex-1 truncate text-sm font-medium text-nuffle-anthracite hover:text-nuffle-bronze hover:underline"
          title={starter.pseudonym}
        >
          {starter.pseudonym}
        </Link>
        <span className="shrink-0 font-mono text-sm font-semibold text-nuffle-anthracite">
          {sppDisplay}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] text-nuffle-anthracite/60">
        <span>
          {starter.bbPosition} · {starter.nflPosition} ·{" "}
          {starter.teamCode ?? "FA"}
        </span>
        {settled && starter.rawSpp != null && (
          <span className="font-mono">
            brut {starter.rawSpp}
            {starter.captainBonus > 0 && (
              <span className="ml-1 text-amber-700">
                +{starter.captainBonus} (C/V)
              </span>
            )}
          </span>
        )}
      </div>

      {settled && hasBreakdown && (
        <>
          <button
            type="button"
            onClick={onToggle}
            className="mt-1.5 text-xs text-nuffle-bronze hover:underline"
            data-testid={`expand-${starter.playerId}`}
          >
            {isExpanded ? "Masquer le détail SPP" : "Voir le détail SPP"}
          </button>
          {isExpanded && (
            <div
              className="mt-2 rounded-md border border-nuffle-bronze/20 bg-nuffle-ivory/40 p-2.5"
              data-testid={`breakdown-${starter.playerId}`}
            >
              {starter.events.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-nuffle-anthracite/70">
                    Stats NFL → SPP
                  </p>
                  <ul className="mt-1 space-y-1">
                    {starter.events.map((e, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${EVENT_TYPE_COLOR[e.type]}`}
                          >
                            {EVENT_TYPE_LABEL[e.type]}
                          </span>
                          <span className="truncate text-nuffle-anthracite/80">
                            {e.reason}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-nuffle-anthracite">
                          {e.count > 1 ? `×${e.count} → ` : ""}
                          {e.spp >= 0 ? "+" : ""}
                          {e.spp}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {starter.skillBonuses.length > 0 && (
                <div className={starter.events.length > 0 ? "mt-3" : ""}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-nuffle-anthracite/70">
                    Bonus compétences BB
                  </p>
                  <ul className="mt-1 space-y-1">
                    {starter.skillBonuses.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="rounded border border-purple-300 bg-purple-100 px-1.5 py-0.5 font-mono text-[10px] text-purple-800">
                            ✨ {b.skill}
                          </span>
                          <span className="truncate text-nuffle-anthracite/80">
                            {b.reason}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-nuffle-anthracite">
                          {b.count > 1 ? `×${b.count} → ` : ""}+{b.spp}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {settled && starter.rawStats && (
        <RawStatsExpand
          rawStats={starter.rawStats}
          nflPosition={starter.nflPosition}
          starterId={starter.starterId}
        />
      )}
    </li>
  );
}

// ────────────────────────────────────────────────────────────────────
// Raw stats NFL — toggle independant pour cross-check
// ────────────────────────────────────────────────────────────────────

/**
 * Champs nflverse mis en avant par groupe NFL position. Permet de
 * trier l'affichage : les stats les plus pertinentes en premier,
 * puis le reste alphabetique. Les cles sont les noms nflverse bruts.
 */
const KEY_STATS_BY_ROLE: Readonly<Record<string, ReadonlyArray<string>>> = {
  QB: [
    "completions",
    "attempts",
    "passing_yards",
    "passing_tds",
    "passing_interceptions",
    "sacks_suffered",
    "rushing_yards",
    "rushing_tds",
  ],
  RB: [
    "carries",
    "rushing_yards",
    "rushing_tds",
    "targets",
    "receptions",
    "receiving_yards",
    "receiving_tds",
    "rushing_fumbles_lost",
  ],
  WR: [
    "targets",
    "receptions",
    "receiving_yards",
    "receiving_tds",
    "receiving_fumbles_lost",
  ],
  TE: [
    "targets",
    "receptions",
    "receiving_yards",
    "receiving_tds",
    "receiving_fumbles_lost",
  ],
  FB: ["carries", "rushing_yards", "rushing_tds", "receptions"],
  DEF: [
    "def_tackles_solo",
    "def_tackles_with_assist",
    "def_sacks",
    "def_interceptions",
    "def_pass_defended",
    "def_fumbles_forced",
    "def_tackles_for_loss",
    "def_qb_hits",
    "def_tds",
  ],
};

const DEFENSIVE_NFL = new Set([
  "DE",
  "DT",
  "NT",
  "LB",
  "ILB",
  "OLB",
  "MLB",
  "CB",
  "S",
  "SS",
  "FS",
  "DB",
  "EDGE",
]);

function keyStatsFor(nflPosition: string): ReadonlyArray<string> {
  if (KEY_STATS_BY_ROLE[nflPosition]) return KEY_STATS_BY_ROLE[nflPosition];
  if (DEFENSIVE_NFL.has(nflPosition)) return KEY_STATS_BY_ROLE.DEF;
  return [];
}

function RawStatsExpand({
  rawStats,
  nflPosition,
  starterId,
}: {
  rawStats: Record<string, unknown>;
  nflPosition: string;
  starterId: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const keys = keyStatsFor(nflPosition);
  const keyEntries: Array<{ key: string; value: string }> = keys.map((k) => ({
    key: k,
    value: formatStatValue(rawStats[k]),
  }));
  const otherEntries: Array<{ key: string; value: string }> = Object.entries(
    rawStats,
  )
    .filter(([k, v]) => !keys.includes(k) && isInterestingStat(k, v))
    .map(([k, v]) => ({ key: k, value: formatStatValue(v) }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 ml-3 text-xs text-nuffle-bronze hover:underline"
        data-testid={`raw-${starterId}`}
      >
        {open ? "Masquer les stats NFL brutes" : "Voir les stats NFL brutes"}
      </button>
      {open && (
        <div
          className="mt-2 rounded-md border border-nuffle-bronze/20 bg-white p-2.5"
          data-testid={`raw-block-${starterId}`}
        >
          {keyEntries.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-nuffle-anthracite/70">
                Stats clés ({nflPosition})
              </p>
              <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs sm:grid-cols-3">
                {keyEntries.map((e) => (
                  <li key={e.key} className="flex justify-between gap-2">
                    <span className="truncate text-nuffle-anthracite/70">
                      {e.key}
                    </span>
                    <span className="shrink-0 font-mono text-nuffle-anthracite">
                      {e.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {otherEntries.length > 0 && (
            <div className={keyEntries.length > 0 ? "mt-3" : ""}>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-[11px] font-semibold uppercase tracking-wide text-nuffle-anthracite/70 hover:text-nuffle-bronze"
              >
                {showAll ? "▾" : "▸"} Toutes les autres stats nflverse (
                {otherEntries.length})
              </button>
              {showAll && (
                <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-3">
                  {otherEntries.map((e) => (
                    <li key={e.key} className="flex justify-between gap-2">
                      <span className="truncate text-nuffle-anthracite/60">
                        {e.key}
                      </span>
                      <span className="shrink-0 font-mono text-nuffle-anthracite/80">
                        {e.value}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {keyEntries.length === 0 && otherEntries.length === 0 && (
            <p className="text-xs text-nuffle-anthracite/60">
              Aucune statistique non-nulle disponible.
            </p>
          )}
          <p className="mt-2 text-[10px] text-nuffle-anthracite/50">
            Source : nflverse. Voir{" "}
            <Link
              href="/nfl-fantasy/rules"
              className="text-nuffle-bronze hover:underline"
            >
              les règles de calcul
            </Link>{" "}
            pour comprendre l&apos;impact sur les SPP.
          </p>
        </div>
      )}
    </>
  );
}

function formatStatValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return v.toString();
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "oui" : "non";
  return JSON.stringify(v);
}

/**
 * Filtre les stats peu utiles : url images, ids techniques, valeurs
 * nulles ou string vide, ratios proches de zero. Garde tout ce qui a
 * une valeur non-triviale.
 */
function isInterestingStat(key: string, v: unknown): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "string") {
    if (v.startsWith("http")) return false; // headshot_url
    if (v === "0" || v === "0.0" || v === "0.00") return false;
    if (key.endsWith("_url") || key === "player_id" || key === "game_id") {
      return false;
    }
  }
  if (typeof v === "number" && v === 0) return false;
  return true;
}
