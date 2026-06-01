"use client";
import { useCallback, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

// Workstream ligue offline — saisie manuelle d'un resultat de match joue
// hors-ligne. Reservee au createur de la ligue. POST le score + casualties
// par equipe (+ stats par joueur optionnelles pour le SPP) puis refresh.

interface EnterResultModalProps {
  pairingId: string;
  homeName: string;
  awayName: string;
  onClose: () => void;
  onRecorded: () => void;
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
}: EnterResultModalProps) {
  const { t } = useLanguage();
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);
  const [casualtiesHome, setCasualtiesHome] = useState(0);
  const [casualtiesAway, setCasualtiesAway] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showStats, setShowStats] = useState(false);
  const [rosters, setRosters] = useState<PairingRosters | null>(null);
  const [stats, setStats] = useState<Record<string, PlayerStatEntry>>({});

  const toggleStats = useCallback(async () => {
    const next = !showStats;
    setShowStats(next);
    if (next && !rosters) {
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
    }
  }, [showStats, rosters, pairingId, homeName, awayName]);

  const updateStat = useCallback(
    (playerId: string, patch: Partial<PlayerStatEntry>) => {
      setStats((prev) => ({
        ...prev,
        [playerId]: { ...(prev[playerId] ?? EMPTY_STAT), ...patch },
      }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      const playerStats = Object.entries(stats)
        .filter(([, s]) => hasAnyStat(s))
        .map(([teamPlayerId, s]) => ({ teamPlayerId, ...s }));
      try {
        await apiRequest(`/leagues/pairings/${pairingId}/result`, {
          method: "POST",
          body: JSON.stringify({
            scoreHome,
            scoreAway,
            casualtiesHome,
            casualtiesAway,
            ...(playerStats.length > 0 ? { playerStats } : {}),
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
      pairingId,
      scoreHome,
      scoreAway,
      casualtiesHome,
      casualtiesAway,
      stats,
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
          {t.leagues.recordResultTitle}
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
                />
                <PlayerStatsTable
                  side={rosters.away}
                  stats={stats}
                  onChange={updateStat}
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
            min={0}
            max={30}
            data-testid={`result-${testid}-home`}
            value={home}
            onChange={(e) => setHome(clampScore(e.target.value))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 truncate block">
            {awayLabel}
          </span>
          <input
            type="number"
            min={0}
            max={30}
            data-testid={`result-${testid}-away`}
            value={away}
            onChange={(e) => setAway(clampScore(e.target.value))}
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
}

function PlayerStatsTable({ side, stats, onChange }: PlayerStatsTableProps) {
  return (
    <div className="min-w-0">
      <div className="text-sm font-semibold text-nuffle-anthracite mb-1 truncate">
        {side.teamName}
      </div>
      {side.players.length === 0 ? (
        <div className="text-xs text-gray-400">—</div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_repeat(4,2rem)_1.5rem] gap-1 text-[10px] uppercase text-gray-400 px-1">
            <span />
            <span className="text-center">TD</span>
            <span className="text-center">Cas</span>
            <span className="text-center">Pas</span>
            <span className="text-center">Int</span>
            <span className="text-center">MVP</span>
          </div>
          {side.players.map((p) => {
            const s = stats[p.id] ?? EMPTY_STAT;
            return (
              <div
                key={p.id}
                data-testid={`stat-row-${p.id}`}
                className="grid grid-cols-[1fr_repeat(4,2rem)_1.5rem] gap-1 items-center"
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
