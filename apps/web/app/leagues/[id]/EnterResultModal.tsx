"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

// Workstream ligue offline — saisie manuelle d'un resultat de match joue
// hors-ligne. Reservee au createur de la ligue. POST (saisie) ou PUT (edition)
// le score + casualties par equipe (+ stats par joueur / eco / blessures) puis
// refresh. En mode edition, pre-remplit depuis le resultat deja enregistre.

interface EnterResultModalProps {
  pairingId: string;
  homeName: string;
  awayName: string;
  onClose: () => void;
  onRecorded: () => void;
  /** "edit" pre-remplit le formulaire et PUT au lieu de POST. */
  mode?: "create" | "edit";
}

interface ExistingResultInput {
  scoreHome: number;
  scoreAway: number;
  casualtiesHome: number;
  casualtiesAway: number;
  winningsHome?: number;
  winningsAway?: number;
  dedicatedFansDeltaHome?: number;
  dedicatedFansDeltaAway?: number;
  playerStats?: Array<{ teamPlayerId: string } & PlayerStatEntry>;
  injuries?: Array<{ teamPlayerId: string; type: string }>;
}

interface RosterPlayer {
  id: string;
  name: string;
  number: number;
  position: string;
  spp: number;
}
interface RosterSide {
  teamId: string;
  teamName: string;
  players: RosterPlayer[];
}
interface PairingRosters {
  home: RosterSide;
  away: RosterSide;
}

interface PlayerStatEntry {
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  mvp: boolean;
}
const EMPTY_STAT: PlayerStatEntry = {
  touchdowns: 0,
  casualties: 0,
  completions: 0,
  interceptions: 0,
  mvp: false,
};

/** Normalise une saisie en entier [0, 30]. */
function clampScore(raw: string): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 30);
}

/** Or gagne : entier [0, 300000]. */
function clampGold(raw: string): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 300000);
}

/** Variation de dedicated fans : entier signe [-6, 6]. */
function clampFansDelta(raw: string): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.max(-6, Math.min(6, n));
}

function hasAnyStat(s: PlayerStatEntry): boolean {
  return (
    s.touchdowns > 0 ||
    s.casualties > 0 ||
    s.completions > 0 ||
    s.interceptions > 0 ||
    s.mvp
  );
}

export function EnterResultModal({
  pairingId,
  homeName,
  awayName,
  onClose,
  onRecorded,
  mode = "create",
}: EnterResultModalProps) {
  const { t } = useLanguage();
  const isEdit = mode === "edit";
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);
  const [casualtiesHome, setCasualtiesHome] = useState(0);
  const [casualtiesAway, setCasualtiesAway] = useState(0);
  const [winningsHome, setWinningsHome] = useState(0);
  const [winningsAway, setWinningsAway] = useState(0);
  const [fansDeltaHome, setFansDeltaHome] = useState(0);
  const [fansDeltaAway, setFansDeltaAway] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showStats, setShowStats] = useState(false);
  const [rosters, setRosters] = useState<PairingRosters | null>(null);
  const [stats, setStats] = useState<Record<string, PlayerStatEntry>>({});
  const [injuries, setInjuries] = useState<Record<string, string>>({});

  const loadRosters = useCallback(async () => {
    try {
      const data = await apiRequest<PairingRosters>(
        `/leagues/pairings/${pairingId}/rosters`,
      );
      setRosters(data);
    } catch {
      // Echec non bloquant : la saisie score-seul reste possible.
      setRosters({
        home: { teamId: "", teamName: homeName, players: [] },
        away: { teamId: "", teamName: awayName, players: [] },
      });
    }
  }, [pairingId, homeName, awayName]);

  const toggleStats = useCallback(async () => {
    const next = !showStats;
    setShowStats(next);
    if (next && !rosters) await loadRosters();
  }, [showStats, rosters, loadRosters]);

  // Mode edition : pre-remplit depuis le resultat deja enregistre. Si des
  // stats/blessures existent, deplie la section et charge les rosters pour
  // que le createur voie et conserve l'integralite de la saisie.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const { input } = await apiRequest<{ input: ExistingResultInput }>(
          `/leagues/pairings/${pairingId}/result`,
        );
        if (cancelled) return;
        setScoreHome(input.scoreHome);
        setScoreAway(input.scoreAway);
        setCasualtiesHome(input.casualtiesHome);
        setCasualtiesAway(input.casualtiesAway);
        setWinningsHome(input.winningsHome ?? 0);
        setWinningsAway(input.winningsAway ?? 0);
        setFansDeltaHome(input.dedicatedFansDeltaHome ?? 0);
        setFansDeltaAway(input.dedicatedFansDeltaAway ?? 0);
        const statMap: Record<string, PlayerStatEntry> = {};
        for (const s of input.playerStats ?? []) {
          statMap[s.teamPlayerId] = {
            touchdowns: s.touchdowns,
            casualties: s.casualties,
            completions: s.completions,
            interceptions: s.interceptions,
            mvp: s.mvp,
          };
        }
        const injMap: Record<string, string> = {};
        for (const inj of input.injuries ?? []) {
          injMap[inj.teamPlayerId] = inj.type;
        }
        setStats(statMap);
        setInjuries(injMap);
        if ((input.playerStats?.length ?? 0) > 0 || (input.injuries?.length ?? 0) > 0) {
          setShowStats(true);
          await loadRosters();
        }
      } catch {
        // Pre-remplissage best-effort : en cas d'echec, formulaire vide.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, pairingId, loadRosters]);

  const updateStat = useCallback(
    (playerId: string, patch: Partial<PlayerStatEntry>) => {
      setStats((prev) => ({
        ...prev,
        [playerId]: { ...(prev[playerId] ?? EMPTY_STAT), ...patch },
      }));
    },
    [],
  );

  const updateInjury = useCallback((playerId: string, type: string) => {
    setInjuries((prev) => ({ ...prev, [playerId]: type }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      const playerStats = Object.entries(stats)
        .filter(([, s]) => hasAnyStat(s))
        .map(([teamPlayerId, s]) => ({ teamPlayerId, ...s }));
      const injuryList = Object.entries(injuries)
        .filter(([, type]) => type)
        .map(([teamPlayerId, type]) => ({ teamPlayerId, type }));
      try {
        await apiRequest(`/leagues/pairings/${pairingId}/result`, {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify({
            scoreHome,
            scoreAway,
            casualtiesHome,
            casualtiesAway,
            ...(playerStats.length > 0 ? { playerStats } : {}),
            ...(winningsHome > 0 ? { winningsHome } : {}),
            ...(winningsAway > 0 ? { winningsAway } : {}),
            ...(fansDeltaHome !== 0
              ? { dedicatedFansDeltaHome: fansDeltaHome }
              : {}),
            ...(fansDeltaAway !== 0
              ? { dedicatedFansDeltaAway: fansDeltaAway }
              : {}),
            ...(injuryList.length > 0 ? { injuries: injuryList } : {}),
          }),
        });
        onRecorded();
        onClose();
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : t.leagues.recordResultError,
        );
        setSubmitting(false);
      }
    },
    [
      submitting,
      isEdit,
      pairingId,
      scoreHome,
      scoreAway,
      casualtiesHome,
      casualtiesAway,
      winningsHome,
      winningsAway,
      fansDeltaHome,
      fansDeltaAway,
      stats,
      injuries,
      onRecorded,
      onClose,
      t.leagues.recordResultError,
    ],
  );

  return (
    <div
      data-testid="enter-result-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-lg shadow-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto ${
          showStats ? "max-w-3xl" : "max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          {isEdit ? t.leagues.editResultTitle : t.leagues.recordResultTitle}
        </h2>
        <p className="text-sm text-gray-600">
          {homeName} <span className="text-gray-400">vs</span> {awayName}
        </p>

        {error ? (
          <div
            data-testid="enter-result-error"
            className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <ResultRow
            label={t.leagues.recordResultTouchdowns}
            homeLabel={homeName}
            awayLabel={awayName}
            testid="td"
            home={scoreHome}
            away={scoreAway}
            setHome={setScoreHome}
            setAway={setScoreAway}
          />
          <ResultRow
            label={t.leagues.recordResultCasualties}
            homeLabel={homeName}
            awayLabel={awayName}
            testid="cas"
            home={casualtiesHome}
            away={casualtiesAway}
            setHome={setCasualtiesHome}
            setAway={setCasualtiesAway}
          />

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <span className="text-sm font-medium text-gray-700">
              {t.leagues.recordResultEconomy}
            </span>
            <ResultRow
              label={t.leagues.recordResultWinnings}
              homeLabel={homeName}
              awayLabel={awayName}
              testid="winnings"
              home={winningsHome}
              away={winningsAway}
              setHome={setWinningsHome}
              setAway={setWinningsAway}
              clamp={clampGold}
              min={0}
              max={300000}
              step={1000}
            />
            <ResultRow
              label={t.leagues.recordResultDedicatedFans}
              homeLabel={homeName}
              awayLabel={awayName}
              testid="fans"
              home={fansDeltaHome}
              away={fansDeltaAway}
              setHome={setFansDeltaHome}
              setAway={setFansDeltaAway}
              clamp={clampFansDelta}
              min={-6}
              max={6}
            />
          </div>

          <div className="border-t border-gray-100 pt-3">
            <button
              type="button"
              data-testid="toggle-player-stats"
              onClick={toggleStats}
              className="text-sm font-medium text-nuffle-anthracite flex items-center gap-2"
            >
              <span>{showStats ? "▼" : "▶"}</span>
              {t.leagues.recordResultPlayerStatsToggle}
            </button>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.leagues.recordResultPlayerStatsHint}
            </p>
            {showStats && rosters ? (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <PlayerStatsTable
                  side={rosters.home}
                  stats={stats}
                  onChange={updateStat}
                  injuries={injuries}
                  onInjuryChange={updateInjury}
                />
                <PlayerStatsTable
                  side={rosters.away}
                  stats={stats}
                  onChange={updateStat}
                  injuries={injuries}
                  onInjuryChange={updateInjury}
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm"
            >
              {t.leagues.recordResultCancel}
            </button>
            <button
              type="submit"
              data-testid="enter-result-submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
            >
              {t.leagues.recordResultSave}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ResultRowProps {
  label: string;
  homeLabel: string;
  awayLabel: string;
  testid: string;
  home: number;
  away: number;
  setHome: (n: number) => void;
  setAway: (n: number) => void;
  clamp?: (raw: string) => number;
  min?: number;
  max?: number;
  step?: number;
}

function ResultRow({
  label,
  homeLabel,
  awayLabel,
  testid,
  home,
  away,
  setHome,
  setAway,
  clamp = clampScore,
  min = 0,
  max = 30,
  step,
}: ResultRowProps) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-gray-500 truncate block">
            {homeLabel}
          </span>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            data-testid={`result-${testid}-home`}
            value={home}
            onChange={(e) => setHome(clamp(e.target.value))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 truncate block">
            {awayLabel}
          </span>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            data-testid={`result-${testid}-away`}
            value={away}
            onChange={(e) => setAway(clamp(e.target.value))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
    </div>
  );
}

interface PlayerStatsTableProps {
  side: RosterSide;
  stats: Record<string, PlayerStatEntry>;
  onChange: (playerId: string, patch: Partial<PlayerStatEntry>) => void;
  injuries: Record<string, string>;
  onInjuryChange: (playerId: string, type: string) => void;
}

const INJURY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "mng", label: "MNG" },
  { value: "niggling", label: "Nig." },
  { value: "ma", label: "-MA" },
  { value: "st", label: "-ST" },
  { value: "ag", label: "-AG" },
  { value: "pa", label: "-PA" },
  { value: "av", label: "-AV" },
  { value: "dead", label: "†" },
];

const STATS_GRID = "grid grid-cols-[1fr_repeat(4,1.8rem)_1.1rem_2.8rem] gap-1";

function PlayerStatsTable({
  side,
  stats,
  onChange,
  injuries,
  onInjuryChange,
}: PlayerStatsTableProps) {
  const { t } = useLanguage();
  return (
    <div className="min-w-0">
      <div className="text-sm font-semibold text-nuffle-anthracite mb-1 truncate">
        {side.teamName}
      </div>
      {side.players.length === 0 ? (
        <div className="text-xs text-gray-400">—</div>
      ) : (
        <div className="space-y-1">
          <div
            className={`${STATS_GRID} text-[10px] uppercase text-gray-400 px-1`}
          >
            <span />
            <span className="text-center">TD</span>
            <span className="text-center">Cas</span>
            <span className="text-center">Pas</span>
            <span className="text-center">Int</span>
            <span className="text-center">MVP</span>
            <span
              className="text-center"
              title={t.leagues.recordResultInjury}
            >
              ✚
            </span>
          </div>
          {side.players.map((p) => {
            const s = stats[p.id] ?? EMPTY_STAT;
            return (
              <div
                key={p.id}
                data-testid={`stat-row-${p.id}`}
                className={`${STATS_GRID} items-center`}
              >
                <span className="text-xs text-gray-700 truncate" title={p.name}>
                  <span className="text-gray-400">#{p.number}</span> {p.name}
                </span>
                <NumCell
                  value={s.touchdowns}
                  onChange={(v) => onChange(p.id, { touchdowns: v })}
                />
                <NumCell
                  value={s.casualties}
                  onChange={(v) => onChange(p.id, { casualties: v })}
                />
                <NumCell
                  value={s.completions}
                  onChange={(v) => onChange(p.id, { completions: v })}
                />
                <NumCell
                  value={s.interceptions}
                  onChange={(v) => onChange(p.id, { interceptions: v })}
                />
                <input
                  type="checkbox"
                  data-testid={`stat-${p.id}-mvp`}
                  checked={s.mvp}
                  onChange={(e) => onChange(p.id, { mvp: e.target.checked })}
                  className="mx-auto"
                />
                <select
                  data-testid={`stat-${p.id}-injury`}
                  value={injuries[p.id] ?? ""}
                  onChange={(e) => onInjuryChange(p.id, e.target.value)}
                  className="w-full rounded border border-gray-300 text-[10px] px-0.5 py-0.5"
                >
                  {INJURY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NumCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      value={value}
      onChange={(e) => onChange(clampScore(e.target.value))}
      className="w-8 rounded border border-gray-300 px-1 py-0.5 text-xs text-center"
    />
  );
}
