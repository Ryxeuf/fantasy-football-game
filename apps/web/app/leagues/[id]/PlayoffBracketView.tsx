"use client";
/**
 * L2.C.3 — Sprint Ligues v2 PR8 : visualisation du bracket de playoffs.
 *
 * Lit `GET /league/seasons/:sid/playoff-bracket` et rend les rounds
 * (QF / SF / Final) en colonnes, chaque round comme une carte par
 * pairing avec les deux teams + status. Les pairings dont les deux
 * cotes pointent vers le meme participant sont consideres en
 * "TBD" (placeholder cree par advancePlayoffsWithWinner avant
 * l'arrivee du sibling winner).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import TeamLogo from "../../components/TeamLogo";

interface BracketTeam {
  id: string;
  name: string;
  roster: string;
  /** Logo uploadé par le coach (null => logo dérivé du roster). */
  logoUrl?: string | null;
  owner: { id: string; coachName: string | null };
}

interface BracketParticipant {
  id: string;
  team: BracketTeam;
}

interface BracketPairing {
  id: string;
  status: string;
  homeParticipant: BracketParticipant;
  awayParticipant: BracketParticipant;
  match: { id: string; status: string } | null;
}

interface BracketRound {
  id: string;
  roundNumber: number;
  bracketSlot: string | null;
  status: string;
  pairings: BracketPairing[];
}

interface BracketResponse {
  seasonId: string;
  playoffSize: number;
  seasonStatus: string;
  rounds: BracketRound[];
  /**
   * Bracket PUBLIÉ par le commissaire. Tant qu'il ne l'est pas, l'API sert
   * `rounds: []` aux coachs : le bracket est généré automatiquement à la
   * clôture de la phase régulière, mais le commissaire vérifie d'abord les
   * seeds. Optionnel : rétro-compat avec une API antérieure (= publié).
   */
  playoffsPublished?: boolean;
  /** Optionnels : rétro-compat avec une API pré-panneau commissaire. */
  regularSeasonComplete?: boolean;
  poolQualification?: {
    totalQualified: number;
    playoffSize: number;
    consistent: boolean;
  };
}

/** Participant éligible au bracket (équipe active de la saison). */
export interface EligibleParticipant {
  id: string;
  name: string;
}

interface Props {
  seasonId: string;
  /** FR3 — affiche l'édition des participants du bracket (commissaire). */
  isCommissioner?: boolean;
  /** FR3 — participants actifs sélectionnables comme seeds. */
  eligibleParticipants?: EligibleParticipant[];
  /** Rappelé après un override réussi (pour rafraîchir la saison). */
  onChanged?: () => void;
}

/** Aplati les seeds courants du 1er tour du bracket (ordre home, away…). */
export function currentSeedsFromRounds(
  rounds: BracketRound[],
  size: number,
): string[] {
  const firstStage = size === 8 ? "qf" : size === 4 ? "sf" : "final";
  const stageRounds = rounds
    .filter((r) => (r.bracketSlot ?? "").startsWith(firstStage))
    .sort((a, b) => a.roundNumber - b.roundNumber);
  const seeds: string[] = [];
  for (const r of stageRounds) {
    const p = r.pairings[0];
    if (!p) continue;
    seeds.push(p.homeParticipant.id);
    // Évite de dupliquer un placeholder (home === away).
    if (p.awayParticipant.id !== p.homeParticipant.id) {
      seeds.push(p.awayParticipant.id);
    }
  }
  return seeds;
}

export function PlayoffBracketView({
  seasonId,
  isCommissioner = false,
  eligibleParticipants = [],
  onChanged,
}: Props) {
  const [data, setData] = useState<BracketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!seasonId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<BracketResponse>(
        `/leagues/seasons/${seasonId}/playoff-bracket`,
      );
      setData(res);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Erreur chargement bracket",
      );
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    load();
  }, [load]);

  // Group rounds by stage : QFs together, SFs together, Final.
  const stages = useMemo(() => {
    if (!data) return [];
    const buckets = new Map<string, BracketRound[]>();
    for (const round of data.rounds) {
      const slot = round.bracketSlot ?? "";
      const stage = slot.startsWith("qf")
        ? "qf"
        : slot.startsWith("sf")
          ? "sf"
          : slot === "final"
            ? "final"
            : "other";
      const bucket = buckets.get(stage) ?? [];
      bucket.push(round);
      buckets.set(stage, bucket);
    }
    const order = ["qf", "sf", "final"];
    return order
      .filter((stage) => buckets.has(stage))
      .map((stage) => ({
        stage,
        title: stageTitle(stage),
        rounds: (buckets.get(stage) ?? []).sort(
          (a, b) => a.roundNumber - b.roundNumber,
        ),
      }));
  }, [data]);

  if (loading) {
    return (
      <div data-testid="playoff-bracket-loading" className="text-sm text-gray-500">
        Chargement du bracket…
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="playoff-bracket-error"
        className="text-sm text-red-600"
      >
        Erreur : {error}
      </div>
    );
  }

  if (!data || data.rounds.length === 0) {
    // Pas encore de bracket. Pour le commissaire on rend un panneau
    // d'état + de lancement ; pour les autres, rien (comportement
    // historique).
    if (!data || !isCommissioner) return null;
    return (
      <PlayoffLaunchPanel
        seasonId={seasonId}
        data={data}
        onChanged={() => {
          load();
          onChanged?.();
        }}
      />
    );
  }

  // FR3 — édition possible tant qu'aucun match de playoff n'est lancé/joué.
  const canEditSeeds =
    isCommissioner &&
    data.rounds.length > 0 &&
    data.rounds.every((r) =>
      r.pairings.every((p) => p.status === "scheduled" && !p.match),
    );
  // `undefined` = API antérieure à la publication : bracket servi = visible.
  const published = data.playoffsPublished !== false;

  return (
    <section
      data-testid="playoff-bracket"
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <h3 className="text-md font-semibold text-nuffle-anthracite">
        Bracket des playoffs
      </h3>
      {isCommissioner ? (
        <PlayoffPublishToggle
          seasonId={seasonId}
          published={published}
          onChanged={() => {
            load();
            onChanged?.();
          }}
        />
      ) : null}
      {canEditSeeds ? (
        <PlayoffParticipantsEditor
          seasonId={seasonId}
          playoffSize={data.playoffSize}
          eligibleParticipants={eligibleParticipants}
          currentSeeds={currentSeedsFromRounds(data.rounds, data.playoffSize)}
          onSaved={() => {
            load();
            onChanged?.();
          }}
        />
      ) : null}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <div
            key={stage.stage}
            data-testid={`playoff-stage-${stage.stage}`}
            className="flex-shrink-0 w-64 space-y-2"
          >
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {stage.title}
            </h4>
            {stage.rounds.map((round) => (
              <RoundCard key={round.id} round={round} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Publication du bracket par le commissaire. Le bracket est généré
 * automatiquement à la clôture de la phase régulière, mais reste invisible
 * aux coachs tant qu'il n'est pas publié : le commissaire peut d'abord
 * corriger les seeds (saisie en retard, désistement) sans que la ligue
 * découvre un bracket provisoire.
 */
function PlayoffPublishToggle({
  seasonId,
  published,
  onChanged,
}: {
  seasonId: string;
  published: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(
        `/leagues/seasons/${seasonId}/playoff-bracket/publish`,
        {
          method: "PATCH",
          body: JSON.stringify({ published: !published }),
        },
      );
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }, [seasonId, published, onChanged]);

  return (
    <div
      data-testid="playoff-publish"
      className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        published
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-300 bg-amber-50 text-amber-900"
      }`}
    >
      <span data-testid="playoff-publish-state">
        {published
          ? "Bracket publié — visible par tous les coachs."
          : "Bracket non publié — visible de toi seul pour l'instant."}
      </span>
      <button
        type="button"
        data-testid="playoff-publish-toggle"
        onClick={toggle}
        disabled={busy}
        className="rounded-md border border-nuffle-gold bg-white px-3 py-1 text-sm font-medium text-nuffle-bronze hover:bg-nuffle-gold/10 disabled:opacity-50"
      >
        {published ? "Dépublier" : "Publier les playoffs"}
      </button>
      {error ? (
        <span data-testid="playoff-publish-error" className="text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}

interface EditorProps {
  seasonId: string;
  playoffSize: number;
  eligibleParticipants: EligibleParticipant[];
  currentSeeds: string[];
  onSaved: () => void;
}

/**
 * FR3 — éditeur des participants du bracket. Le commissaire choisit, pour
 * chacun des `playoffSize` seeds, une équipe active de la saison. Le bracket
 * est régénéré côté serveur (`PATCH …/playoff-bracket/participants`).
 */
function PlayoffParticipantsEditor({
  seasonId,
  playoffSize,
  eligibleParticipants,
  currentSeeds,
  onSaved,
}: EditorProps) {
  const [open, setOpen] = useState(false);
  const [seeds, setSeeds] = useState<string[]>(() =>
    Array.from({ length: playoffSize }, (_, i) => currentSeeds[i] ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setSeeds(Array.from({ length: playoffSize }, (_, i) => currentSeeds[i] ?? ""));
    setError(null);
  }, [currentSeeds, playoffSize]);

  const filled = seeds.every((s) => s.length > 0);
  const unique = new Set(seeds).size === seeds.length;

  const submit = useCallback(async () => {
    if (!filled) {
      setError(`Sélectionnez ${playoffSize} équipes.`);
      return;
    }
    if (!unique) {
      setError("Une équipe est sélectionnée plusieurs fois.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest(
        `/leagues/seasons/${seasonId}/playoff-bracket/participants`,
        { method: "PATCH", body: JSON.stringify({ participantIds: seeds }) },
      );
      setOpen(false);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }, [filled, unique, playoffSize, seasonId, seeds, onSaved]);

  if (!open) {
    return (
      <button
        type="button"
        data-testid="playoff-edit-participants"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="self-start px-3 py-1.5 rounded-md bg-white border border-nuffle-gold text-nuffle-bronze text-sm font-medium hover:bg-nuffle-gold/10"
      >
        ✏️ Modifier les participants des playoffs
      </button>
    );
  }

  return (
    <div
      data-testid="playoff-participants-editor"
      className="border border-amber-200 bg-amber-50/40 rounded-md p-3 space-y-2"
    >
      <div className="text-sm font-medium text-amber-900">
        Participants des playoffs ({playoffSize} équipes, dans l'ordre des seeds)
      </div>
      {error ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {seeds.map((value, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm">
            <span className="w-12 shrink-0 text-xs text-gray-500">
              Seed {idx + 1}
            </span>
            <select
              data-testid={`playoff-seed-${idx}`}
              value={value}
              disabled={busy}
              onChange={(e) =>
                setSeeds((prev) => {
                  const next = [...prev];
                  next[idx] = e.target.value;
                  return next;
                })
              }
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">— Choisir —</option>
              {eligibleParticipants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="playoff-save-participants"
          onClick={submit}
          disabled={busy || !filled}
          className="px-3 py-1.5 rounded-md bg-nuffle-gold text-white text-sm font-medium hover:bg-nuffle-gold/90 disabled:opacity-50"
        >
          Enregistrer le bracket
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function stageTitle(stage: string): string {
  switch (stage) {
    case "qf":
      return "Quarts";
    case "sf":
      return "Demi-finales";
    case "final":
      return "Finale";
    default:
      return stage;
  }
}

interface RoundCardProps {
  round: BracketRound;
}

function RoundCard({ round }: RoundCardProps) {
  const pairing = round.pairings[0];
  if (!pairing) {
    return (
      <div
        data-testid={`playoff-round-${round.id}`}
        className="border border-dashed border-gray-300 rounded-md p-2 bg-gray-50 text-xs text-gray-500"
      >
        En attente
      </div>
    );
  }
  const placeholder =
    pairing.homeParticipant.id === pairing.awayParticipant.id;
  const home = pairing.homeParticipant.team;
  const away = pairing.awayParticipant.team;
  return (
    <div
      data-testid={`playoff-round-${round.id}`}
      className={`border rounded-md p-2 text-sm space-y-1 ${
        placeholder
          ? "border-dashed border-gray-300 bg-gray-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-gray-500">
          {round.bracketSlot}
        </span>
        <PairingBadge status={pairing.status} />
      </div>
      <SideRow team={home} side="home" placeholder={placeholder} />
      <div className="text-center text-xs text-gray-400">vs</div>
      <SideRow team={away} side="away" placeholder={placeholder} />
      {pairing.match ? (
        <Link
          href={`/play/${pairing.match.id}`}
          data-testid={`playoff-pairing-match-${pairing.id}`}
          className="block text-center text-xs text-blue-600 hover:underline mt-1"
        >
          {pairing.status === "played" ? "Voir le match" : "Reprendre"}
        </Link>
      ) : null}
    </div>
  );
}

interface SideRowProps {
  team: BracketTeam;
  side: "home" | "away";
  placeholder: boolean;
}

function SideRow({ team, side, placeholder }: SideRowProps) {
  if (placeholder) {
    return (
      <div
        data-testid={`bracket-side-${side}`}
        className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-gray-100 text-gray-400 italic text-xs"
      >
        <span>TBD</span>
      </div>
    );
  }
  return (
    <div
      data-testid={`bracket-side-${side}`}
      className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-gray-50"
    >
      <TeamLogo
        slug={team.roster}
        logoUrl={team.logoUrl ?? null}
        size={24}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1 truncate">
        <span className="font-medium text-nuffle-anthracite">{team.name}</span>
        <span className="text-xs text-gray-500 ml-1">
          ({team.owner.coachName ?? "Coach"})
        </span>
      </div>
    </div>
  );
}

interface PairingBadgeProps {
  status: string;
}

function PairingBadge({ status }: PairingBadgeProps) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: "A jouer", className: "bg-gray-200 text-gray-700" },
    in_progress: {
      label: "En cours",
      className: "bg-amber-100 text-amber-800",
    },
    played: {
      label: "Joue",
      className: "bg-emerald-100 text-emerald-800",
    },
    forfeit_home: {
      label: "Forfait",
      className: "bg-red-100 text-red-800",
    },
    forfeit_away: {
      label: "Forfait",
      className: "bg-red-100 text-red-800",
    },
    cancelled: {
      label: "Annule",
      className: "bg-gray-100 text-gray-500",
    },
  };
  const entry = map[status] ?? { label: status, className: "bg-gray-100" };
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${entry.className}`}
    >
      {entry.label}
    </span>
  );
}


/** Messages des refus serveur de `startPlayoffs`, par `skippedReason`. */
const START_REFUSAL_HINTS: Record<string, string> = {
  "playoffs-disabled":
    "Choisissez d'abord une taille de bracket (2, 4 ou 8 équipes).",
  "playoffs-already-started": "Le bracket a déjà été généré.",
  "insufficient-participants":
    "Pas assez d'équipes éligibles pour remplir le bracket.",
  "regular-season-incomplete":
    "La phase de poule n'est pas terminée : cochez la clôture anticipée pour la clore maintenant.",
  "pool-qualification-mismatch":
    "Le total des qualifiés par poule ne correspond pas à la taille du bracket.",
};

interface LaunchPanelProps {
  seasonId: string;
  data: BracketResponse;
  onChanged: () => void;
}

/**
 * Panneau commissaire affiché tant qu'aucun bracket n'existe : taille
 * du bracket, état de la phase régulière, cohérence des quotas de
 * poule, et déclenchement manuel (avec clôture anticipée optionnelle).
 */
function PlayoffLaunchPanel({ seasonId, data, onChanged }: LaunchPanelProps) {
  const [size, setSize] = useState<number>(data.playoffSize);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `undefined` = API pré-panneau : on ne peut rien affirmer, on
  // laisse le serveur trancher au clic.
  const regularComplete = data.regularSeasonComplete;
  const pool = data.poolQualification;

  const changeSize = useCallback(
    async (next: number) => {
      setBusy(true);
      setError(null);
      try {
        await apiRequest(`/leagues/seasons/${seasonId}/config`, {
          method: "PATCH",
          body: JSON.stringify({ playoffSize: next }),
        });
        setSize(next);
        onChanged();
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : "Erreur lors de la modification",
        );
      } finally {
        setBusy(false);
      }
    },
    [seasonId, onChanged],
  );

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/leagues/seasons/${seasonId}/playoff/start`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      // Succès : le rechargement remplace ce panneau par le bracket.
      onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur au lancement";
      const hint = Object.entries(START_REFUSAL_HINTS).find(([reason]) =>
        msg.includes(reason),
      )?.[1];
      setError(hint ? `${msg} — ${hint}` : msg);
    } finally {
      setBusy(false);
    }
  }, [seasonId, force, onChanged]);

  return (
    <section
      data-testid="playoff-launch-panel"
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <h3 className="text-md font-semibold text-nuffle-anthracite">
        Playoffs
      </h3>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        Taille du bracket
        <select
          data-testid="playoff-size-select"
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          value={size}
          disabled={busy}
          onChange={(e) => changeSize(Number(e.target.value))}
        >
          <option value={0}>Aucun (pas de playoffs)</option>
          <option value={2}>Finale seule (2)</option>
          <option value={4}>Demi-finales (4)</option>
          <option value={8}>Quarts de finale (8)</option>
        </select>
      </label>

      <ul className="text-sm text-gray-600 space-y-1">
        {regularComplete !== undefined ? (
          <li data-testid="playoff-regular-state">
            Phase de poule :{" "}
            {regularComplete ? "terminée" : "encore en cours"}
          </li>
        ) : null}
        {pool && pool.totalQualified > 0 ? (
          <li data-testid="playoff-pool-state">
            Qualifiés par poule : {pool.totalQualified} pour un bracket de{" "}
            {pool.playoffSize} —{" "}
            {pool.consistent ? "cohérent" : "incohérent"}
          </li>
        ) : null}
      </ul>

      {regularComplete === false ? (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            data-testid="playoff-force-close"
            checked={force}
            disabled={busy}
            onChange={(e) => setForce(e.target.checked)}
          />
          Clôturer la phase de poule en cours (annule les matchs restants)
        </label>
      ) : null}

      <button
        type="button"
        data-testid="playoff-start-button"
        className="px-3 py-1.5 text-sm rounded bg-nuffle-anthracite text-white disabled:opacity-50"
        disabled={busy}
        onClick={start}
      >
        Lancer les playoffs
      </button>

      {error ? (
        <p data-testid="playoff-launch-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </section>
  );
}
