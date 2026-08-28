"use client";

/**
 * Fiche admin d'une équipe — `/admin/teams/[id]`.
 *
 * Remplace la modale de la liste : une modale ne se partage pas par URL, ne
 * se recharge pas, et n'avait pas la place d'afficher un roster complet. La
 * fiche rend désormais les MÊMES informations que la fiche coach
 * (`/me/teams/[id]`) : positions résolues en nom lisible, mots-clés,
 * compétences avec infobulle et distinction base/acquise, accès de montée de
 * niveau, Star Players nommés.
 *
 * Trois affordances propres à l'admin s'y ajoutent : retour à l'écran
 * précédent, navigation entre les équipes du même coach, et le journal des
 * mutations de l'équipe (aperçu + lien vers le journal complet).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getDisplayName, getPlayerCost, type Ruleset } from "@bb/game-engine";

import { API_BASE } from "../../../auth-client";
import { apiRequest } from "../../../lib/api-client";
import { formatPlusStat } from "../../../lib/format-stats";
import KeywordChips from "../../../components/KeywordChips";
import SkillTooltip from "../../../me/teams/components/SkillTooltip";
import SkillAccessBadges from "../../../me/teams/components/SkillAccessBadges";
import StarPlayersPanel, {
  type TeamStarPlayerView,
} from "../../../me/teams/components/StarPlayersPanel";
import {
  buildPositionMetaByPosition,
  buildSkillAccessByPosition,
} from "../../../me/teams/[id]/roster-skill-access";
import {
  buildOwnerTeamNavigation,
  countPlayersByStatus,
  formatGold,
  playerStatusOf,
  rulesetLabel,
  sortPlayersByNumber,
  PLAYER_STATUS_BADGES,
  type AdminOwnerTeam,
  type AdminTeamPlayer,
} from "./team-detail-view";

interface AdminTeamDetail {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly ruleset: string;
  readonly format?: string;
  readonly regionalLeague?: string | null;
  readonly tournamentRuleset?: string | null;
  readonly initialBudget: number;
  readonly treasury: number;
  readonly currentValue: number;
  readonly teamValue: number;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
  readonly createdAt: string;
  readonly deletedAt?: string | null;
  readonly owner: {
    readonly id: string;
    readonly email: string;
    readonly name?: string | null;
    readonly coachName?: string | null;
  };
  readonly players: AdminTeamPlayer[];
  readonly starPlayers: TeamStarPlayerView[];
}

/** Étape du journal, réduite à ce que l'aperçu affiche. */
interface JournalPreviewEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly summary: string;
  readonly actorLabel: string | null;
  readonly actorRole: string;
  readonly treasuryDelta: number | null;
  readonly teamValueDelta: number | null;
}

const JOURNAL_PREVIEW_SIZE = 8;

async function fetchAdminJSON(path: string, init?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Erreur ${res.status}`);
  }
  return json;
}

function deltaCell(delta: number | null): { text: string; className: string } {
  if (!delta) return { text: "—", className: "text-gray-400" };
  const sign = delta > 0 ? "+" : "-";
  return {
    text: `${sign}${formatGold(Math.abs(delta))}`,
    className: delta > 0 ? "text-green-700" : "text-red-700",
  };
}

export default function AdminTeamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const teamId = typeof params?.id === "string" ? params.id : "";

  const [team, setTeam] = useState<AdminTeamDetail | null>(null);
  const [ownerTeams, setOwnerTeams] = useState<AdminOwnerTeam[]>([]);
  const [rosterDetail, setRosterDetail] = useState<any>(null);
  const [journal, setJournal] = useState<JournalPreviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminJSON(`/admin/teams/${teamId}`);
      setTeam(data.team ?? null);
      setOwnerTeams(data.ownerTeams ?? []);
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement de l'équipe");
      setTeam(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  // La fiche affichait le badge « Supprimée » sans aucune issue : la
  // restauration se pilote donc ici, au plus près de l'équipe consultée.
  const handleRestore = useCallback(async () => {
    if (!teamId) return;
    if (!confirm("Restaurer cette équipe ?")) return;
    setRestoring(true);
    try {
      await fetchAdminJSON(`/admin/teams/${teamId}/restore`, {
        method: "POST",
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Erreur lors de la restauration");
    } finally {
      setRestoring(false);
    }
  }, [teamId, load]);

  // Détail roster : positions (mots-clés, compétences de base DB, accès
  // primaire/secondaire). Optionnel — son échec ne doit pas masquer la fiche,
  // seulement dégrader l'affichage des compétences.
  useEffect(() => {
    if (!team?.roster) return;
    let cancelled = false;
    const rulesetQuery = team.ruleset
      ? `&ruleset=${encodeURIComponent(team.ruleset)}`
      : "";
    fetch(`${API_BASE}/api/rosters/${team.roster}?lang=fr${rulesetQuery}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setRosterDetail(json?.roster ?? null);
      })
      .catch(() => {
        if (!cancelled) setRosterDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [team?.roster, team?.ruleset]);

  // Aperçu du journal. Endpoint coach, ouvert aux admins sur n'importe quelle
  // équipe ; en échec on masque simplement le panneau.
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    apiRequest<{ entries: JournalPreviewEntry[] }>(
      `/team/${teamId}/journal?limit=${JOURNAL_PREVIEW_SIZE}`,
    )
      .then((data) => {
        if (!cancelled) setJournal(data?.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setJournal([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const navigation = useMemo(
    () => buildOwnerTeamNavigation(ownerTeams, teamId),
    [ownerTeams, teamId],
  );
  const positionMeta = useMemo(
    () => buildPositionMetaByPosition(rosterDetail?.positions),
    [rosterDetail],
  );
  const skillAccess = useMemo(
    () => buildSkillAccessByPosition(rosterDetail?.positions),
    [rosterDetail],
  );
  const players = useMemo(
    () => sortPlayersByNumber(team?.players ?? []),
    [team?.players],
  );
  const counts = useMemo(() => countPlayersByStatus(players), [players]);

  const ruleset = (team?.ruleset ?? "season_3") as Ruleset;

  if (loading) {
    return (
      <div className="p-8 text-center" data-testid="admin-team-loading">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
        <p className="text-gray-500">Chargement…</p>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          data-testid="admin-team-back"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
        >
          ← Retour
        </button>
        <div
          data-testid="admin-team-error"
          className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
        >
          ⚠️ {error ?? "Équipe introuvable"}
        </div>
      </div>
    );
  }

  const ownerLabel =
    team.owner.coachName || team.owner.name || team.owner.email;

  return (
    <div className="space-y-6" data-testid="admin-team-detail">
      {/* Barre de navigation : retour arrière + fil d'Ariane */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="admin-team-back"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          ← Retour
        </button>
        <Link
          href="/admin/teams"
          data-testid="admin-team-breadcrumb"
          className="text-sm text-gray-500 hover:text-nuffle-anthracite underline underline-offset-2"
        >
          Gestion des équipes
        </Link>
      </div>

      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            ⚽ {team.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {rosterDetail?.name ?? team.roster}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
              {rulesetLabel(team.ruleset)}
            </span>
            {team.deletedAt && (
              <span
                data-testid="admin-team-deleted-badge"
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
              >
                Supprimée
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {team.deletedAt && (
            <button
              type="button"
              data-testid="admin-team-restore"
              onClick={() => void handleRestore()}
              disabled={restoring}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors text-sm font-medium border border-emerald-200"
            >
              {restoring ? "⏳" : "♻️"} Restaurer
            </button>
          )}
          {/* L'édition (positions, Star Players, coups de pouce) vit sur une
              page dédiée : la fiche reste une lecture, et l'admin choisit
              explicitement de basculer en écriture. */}
          <Link
            href={`/admin/teams/${team.id}/edit`}
            data-testid="admin-team-edit-link"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nuffle-gold/20 text-nuffle-anthracite rounded-lg hover:bg-nuffle-gold/30 transition-colors text-sm font-medium border border-nuffle-gold/40"
          >
            ✏️ Éditer
          </Link>
          {/* Journal d'équipe : la frise complète des mutations (trésorerie,
              VE, roster) avec l'auteur de chacune. */}
          <Link
            href={`/me/teams/${team.id}/journal`}
            data-testid="admin-team-journal-link"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium border border-slate-200"
          >
            📜 Journal complet
          </Link>
        </div>
      </div>

      {/* Navigation entre les équipes du même coach */}
      <div
        data-testid="admin-team-owner-nav"
        className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            Équipes de{" "}
            <span className="font-medium text-gray-900">{ownerLabel}</span>
            {navigation.total > 0 && (
              <span className="text-gray-500">
                {" "}
                — {navigation.position || "?"}/{navigation.total}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {navigation.previous ? (
              <Link
                href={`/admin/teams/${navigation.previous.id}`}
                data-testid="admin-team-prev"
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                ← {navigation.previous.name}
              </Link>
            ) : (
              <span className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-300">
                ← Précédente
              </span>
            )}
            {navigation.next ? (
              <Link
                href={`/admin/teams/${navigation.next.id}`}
                data-testid="admin-team-next"
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                {navigation.next.name} →
              </Link>
            ) : (
              <span className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-300">
                Suivante →
              </span>
            )}
          </div>
        </div>
        {navigation.teams.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {navigation.teams.map((other) => {
              const current = other.id === team.id;
              return (
                <Link
                  key={other.id}
                  href={`/admin/teams/${other.id}`}
                  data-testid={`admin-team-sibling-${other.id}`}
                  aria-current={current ? "page" : undefined}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    current
                      ? "bg-nuffle-gold/20 border-nuffle-gold text-nuffle-anthracite"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                  } ${other.deletedAt ? "line-through opacity-60" : ""}`}
                >
                  {other.name}
                  <span className="ml-1.5 text-gray-500">
                    {other.roster} · {other.playerCount} 👥
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Informations générales */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">
            Informations générales
          </h2>
        </div>
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-sm">
          <div>
            <span className="text-gray-600">Propriétaire :</span>{" "}
            <span className="font-medium">{ownerLabel}</span>
            <div className="text-xs text-gray-400 font-mono">
              {team.owner.id}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Email :</span>{" "}
            <span className="font-mono text-xs">{team.owner.email}</span>
          </div>
          <div>
            <span className="text-gray-600">Créée le :</span>{" "}
            <span className="font-medium">
              {new Date(team.createdAt).toLocaleString("fr-FR")}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Valeur d'équipe (VE) :</span>{" "}
            <span className="font-medium">{formatGold(team.teamValue)}</span>
          </div>
          <div>
            <span className="text-gray-600">Valeur actuelle (VEA) :</span>{" "}
            <span className="font-medium">{formatGold(team.currentValue)}</span>
          </div>
          <div>
            <span className="text-gray-600">Trésor :</span>{" "}
            <span className="font-medium">{formatGold(team.treasury)}</span>
          </div>
          <div>
            <span className="text-gray-600">Budget initial :</span>{" "}
            <span className="font-medium">
              {formatGold(team.initialBudget)}
            </span>
          </div>
          {team.regionalLeague && (
            <div>
              <span className="text-gray-600">Ligue régionale :</span>{" "}
              <span className="font-medium">{team.regionalLeague}</span>
            </div>
          )}
          {team.tournamentRuleset && (
            <div>
              <span className="text-gray-600">Règlement de tournoi :</span>{" "}
              <span className="font-medium">{team.tournamentRuleset}</span>
            </div>
          )}
        </div>
      </div>

      {/* Équipement */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">Équipement</h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-gray-600">Relances</div>
              <div className="text-2xl font-bold">{team.rerolls}</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-gray-600">Pom-pom girls</div>
              <div className="text-2xl font-bold">{team.cheerleaders}</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded">
              <div className="text-gray-600">Assistants</div>
              <div className="text-2xl font-bold">{team.assistants}</div>
            </div>
            <div className="bg-purple-50 p-3 rounded">
              <div className="text-gray-600">Fans dévoués</div>
              <div className="text-2xl font-bold">{team.dedicatedFans}</div>
            </div>
          </div>
          {team.apothecary && (
            <div className="mt-3 text-sm text-green-700 font-medium">
              ✓ Apothicaire disponible
            </div>
          )}
        </div>
      </div>

      {/* Composition */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
          <h2 className="text-base sm:text-lg font-semibold">
            Joueurs ({players.length})
          </h2>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">
            {counts.active} actif{counts.active > 1 ? "s" : ""}
            {counts.dead > 0 && ` · ${counts.dead} mort${counts.dead > 1 ? "s" : ""}`}
            {counts.fired > 0 &&
              ` · ${counts.fired} licencié${counts.fired > 1 ? "s" : ""}`}
          </div>
        </div>
        {players.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">Aucun joueur.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-900">#</th>
                  <th className="text-left p-3 font-medium text-gray-900">Nom</th>
                  <th className="text-left p-3 font-medium text-gray-900">
                    Position
                  </th>
                  <th className="text-left p-3 font-medium text-gray-900">Coût</th>
                  <th className="text-left p-3 font-medium text-gray-900">MA</th>
                  <th className="text-left p-3 font-medium text-gray-900">ST</th>
                  <th className="text-left p-3 font-medium text-gray-900">AG</th>
                  <th className="text-left p-3 font-medium text-gray-900">PA</th>
                  <th className="text-left p-3 font-medium text-gray-900">AV</th>
                  <th className="text-left p-3 font-medium text-gray-900">PSP</th>
                  <th className="text-left p-3 font-medium text-gray-900">
                    Compétences
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {players.map((p) => {
                  const status = playerStatusOf(p);
                  const badge =
                    status === "active" ? null : PLAYER_STATUS_BADGES[status];
                  return (
                    <tr
                      key={p.id}
                      data-testid={`admin-team-player-${p.id}`}
                      className={`hover:bg-gray-50 ${
                        status === "active" ? "" : "opacity-60"
                      }`}
                    >
                      <td className="p-3 font-mono font-semibold">{p.number}</td>
                      <td className="p-3 font-medium">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {p.name}
                          {p.isCaptain && status === "active" && (
                            <span
                              title="Capitaine d'équipe"
                              className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5"
                            >
                              C
                            </span>
                          )}
                          {badge && (
                            <span
                              data-testid={`admin-team-player-status-${p.id}`}
                              className={`inline-flex items-center rounded-full text-[10px] font-bold px-1.5 py-0.5 ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 text-xs">
                        <div data-testid={`admin-team-position-${p.id}`}>
                          {getDisplayName(p.position, ruleset)}
                        </div>
                        <KeywordChips
                          keywords={positionMeta.get(p.position)?.keywords}
                          className="mt-1"
                        />
                      </td>
                      <td className="p-3 text-center font-mono text-xs">
                        {formatGold(
                          getPlayerCost(p.position, team.roster, ruleset),
                        )}
                      </td>
                      <td className="p-3 text-center font-mono">{p.ma}</td>
                      <td className="p-3 text-center font-mono">{p.st}</td>
                      <td className="p-3 text-center font-mono">
                        {formatPlusStat(p.ag)}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {formatPlusStat(p.pa)}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {formatPlusStat(p.av)}
                      </td>
                      <td className="p-3 text-center font-mono text-xs">
                        {p.spp ?? 0}
                        <span className="text-gray-400">
                          {" "}
                          / {p.matchesPlayed ?? 0} m.
                        </span>
                      </td>
                      <td className="p-3">
                        <SkillTooltip
                          skillsString={p.skills}
                          teamName={team.roster}
                          position={p.position}
                          dbBaseSkills={positionMeta.get(p.position)?.baseSkills}
                        />
                        <SkillAccessBadges
                          primary={skillAccess.get(p.position)?.primary ?? null}
                          secondary={
                            skillAccess.get(p.position)?.secondary ?? null
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Star Players — même panneau que la fiche coach */}
      <StarPlayersPanel starPlayers={team.starPlayers ?? []} />

      {/* Aperçu du journal */}
      <div
        data-testid="admin-team-journal-preview"
        className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
      >
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base sm:text-lg font-semibold">
            📜 Journal de l'équipe
          </h2>
          <Link
            href={`/me/teams/${team.id}/journal`}
            className="text-sm text-blue-700 hover:underline"
          >
            Voir tout →
          </Link>
        </div>
        {journal.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            Aucune écriture au journal pour cette équipe.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-900">
                    Date
                  </th>
                  <th className="text-left p-3 font-medium text-gray-900">
                    Action
                  </th>
                  <th className="text-left p-3 font-medium text-gray-900">
                    Auteur
                  </th>
                  <th className="text-left p-3 font-medium text-gray-900">
                    Trésor
                  </th>
                  <th className="text-left p-3 font-medium text-gray-900">VE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {journal.map((entry) => {
                  const treasury = deltaCell(entry.treasuryDelta);
                  const value = deltaCell(entry.teamValueDelta);
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="p-3 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="p-3">{entry.summary}</td>
                      <td className="p-3 text-xs text-gray-600">
                        {entry.actorLabel ?? entry.actorRole}
                      </td>
                      <td className={`p-3 font-mono text-xs ${treasury.className}`}>
                        {treasury.text}
                      </td>
                      <td className={`p-3 font-mono text-xs ${value.className}`}>
                        {value.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
