"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../auth-client";

type Team = {
  id: string;
  name: string;
  roster: string;
  ruleset: string;
  initialBudget: number;
  treasury: number;
  currentValue: number;
  teamValue: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  createdAt: string;
  /**
   * Soft delete. Optionnel pour retro-compat : une API anterieure au filtre
   * `deleted` ne renvoie pas le champ, l'equipe est alors traitee comme
   * active plutot que d'afficher un badge faux.
   */
  deletedAt?: string | null;
  owner: {
    id: string;
    email: string;
    name?: string | null;
    coachName?: string | null;
  };
  _count: {
    players: number;
    starPlayers: number;
  };
};

/** Perimetre de suppression demande au serveur (cf. `adminTeamsQuerySchema`). */
type DeletedScope = "active" | "deleted" | "all";

const DELETED_SCOPE_OPTIONS: ReadonlyArray<{
  value: DeletedScope;
  label: string;
}> = [
  { value: "active", label: "Équipes actives" },
  { value: "deleted", label: "Équipes supprimées" },
  { value: "all", label: "Toutes (actives + supprimées)" },
];

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

async function fetchJSON(path: string, options?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rosterFilter, setRosterFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [rulesetFilter, setRulesetFilter] = useState("");
  // Perimetre de suppression. Defaut « active » : une equipe supprimee ne
  // doit plus polluer la liste, mais reste atteignable via ce filtre pour
  // etre restauree.
  const [deletedFilter, setDeletedFilter] =
    useState<DeletedScope>("active");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        sortBy,
        sortOrder,
        ...(search && { search }),
        ...(rosterFilter && { roster: rosterFilter }),
        ...(ownerFilter && { ownerId: ownerFilter }),
        ...(rulesetFilter && { ruleset: rulesetFilter }),
        deleted: deletedFilter,
      });
      const data = await fetchJSON(`/admin/teams?${params}`);
      setTeams(data.teams);
      setPagination(data.pagination);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    sortBy,
    sortOrder,
    search,
    rosterFilter,
    ownerFilter,
    // `rulesetFilter` est lu dans la query : sans lui ici, `loadTeams` n'est
    // pas recree et le select « Tous les rulesets » ne relance aucun fetch.
    rulesetFilter,
    deletedFilter,
  ]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleDelete = async (teamId: string, teamName: string) => {
    // La suppression est un SOFT delete : rien n'est detruit, l'equipe est
    // masquee et reste restaurable. Le message doit le dire, sinon un admin
    // renonce a une action qu'il croit destructrice.
    if (
      !confirm(
        `Supprimer l'équipe "${teamName}" ?\n\nL'équipe sera masquée (joueurs et Star Players conservés). Elle restera restaurable depuis le filtre « Équipes supprimées ».`,
      )
    ) {
      return;
    }
    setActionLoading(teamId);
    try {
      const result = await fetchJSON(`/admin/teams/${teamId}`, {
        method: "DELETE",
      });
      // Le serveur ne bloque pas la suppression d'une equipe engagee (l'action
      // est reversible) mais signale ce qu'elle impacte : sans cet affichage,
      // l'admin sortirait une equipe d'une ligue en cours sans le savoir.
      const warnings: string[] = result?.warnings ?? [];
      if (warnings.length > 0) {
        alert(`Équipe supprimée.\n\n${warnings.join("\n")}`);
      }
      await loadTeams();
    } catch (e: any) {
      alert(e.message || "Erreur lors de la suppression");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (teamId: string, teamName: string) => {
    if (!confirm(`Restaurer l'équipe "${teamName}" ?`)) return;
    setActionLoading(teamId);
    try {
      await fetchJSON(`/admin/teams/${teamId}/restore`, { method: "POST" });
      await loadTeams();
    } catch (e: any) {
      alert(e.message || "Erreur lors de la restauration");
    } finally {
      setActionLoading(null);
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <span className="text-gray-400">↕</span>;
    return sortOrder === "asc" ? <span>↑</span> : <span>↓</span>;
  };

  const formatCurrency = (value: number) => {
    return `${(value / 1000).toFixed(0)}k po`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            ⚽ Gestion des Équipes
          </h1>
          <p className="text-sm text-gray-600">
            Gérez toutes les équipes de la plateforme
          </p>
        </div>
        {pagination && (
          <div className="text-sm text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-200 self-start sm:self-auto">
            {pagination.total} équipe{pagination.total !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4">
        <div className="flex gap-3 sm:gap-4 items-stretch sm:items-center flex-col sm:flex-row sm:flex-wrap">
          <div className="flex-1 sm:min-w-[200px]">
            <input
              type="text"
              placeholder="Rechercher (nom d'équipe)..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
            />
          </div>
          <input
            type="text"
            placeholder="ID propriétaire..."
            value={ownerFilter}
            onChange={(e) => {
              setOwnerFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white sm:min-w-[150px]"
          />
          <select
            value={rosterFilter}
            onChange={(e) => {
              setRosterFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
          >
            <option value="">Tous les rosters</option>
            <option value="skaven">Skavens</option>
            <option value="lizardmen">Hommes-Lézards</option>
            <option value="wood_elf">Elfes Sylvains</option>
            <option value="dark_elf">Elfes Noirs</option>
            <option value="dwarf">Nains</option>
            <option value="orc">Orques</option>
            <option value="human">Humains</option>
            <option value="undead">Morts-Vivants</option>
            <option value="chaos_chosen">Chaos</option>
            <option value="necromantic_horror">Horreur Nécromantique</option>
            <option value="nurgle">Nurgle</option>
            <option value="ogre">Ogres</option>
            <option value="halfling">Halfelins</option>
            <option value="goblin">Gobelins</option>
            <option value="underworld">Sous-Monde</option>
            <option value="chaos_renegade">Renégats du Chaos</option>
            <option value="imperial_nobility">Noblesse Impériale</option>
            <option value="old_world_alliance">Alliance du Vieux Monde</option>
            <option value="elven_union">Union Elfique</option>
            <option value="black_orc">Orques Noirs</option>
            <option value="chaos_dwarf">Nains du Chaos</option>
            <option value="slann">Slann</option>
            <option value="amazon">Amazones</option>
            <option value="high_elf">Hauts Elfes</option>
            <option value="khorne">Khorne</option>
            <option value="vampire">Vampires</option>
            <option value="tomb_kings">Rois des Tombes</option>
            <option value="gnome">Gnomes</option>
            <option value="norse">Nordiques</option>
            <option value="snotling">Snotlings</option>
          </select>
          <select
            value={rulesetFilter}
            onChange={(e) => {
              setRulesetFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
          >
            <option value="">Tous les rulesets</option>
            <option value="season_2">Saison 2</option>
            <option value="season_3">Saison 3</option>
          </select>
          {/* Perimetre de suppression. La liste montrait les equipes
              soft-deletees melangees aux vivantes, sans les distinguer. */}
          <select
            data-testid="admin-teams-deleted-filter"
            aria-label="Périmètre de suppression"
            value={deletedFilter}
            onChange={(e) => {
              setDeletedFilter(e.target.value as DeletedScope);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
          >
            {DELETED_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
            <p className="text-gray-500">Chargement...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {deletedFilter === "deleted"
              ? "Aucune équipe supprimée"
              : "Aucune équipe trouvée"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
              <tr>
                <th
                  className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider cursor-pointer hover:bg-nuffle-gold/20 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    Nom <SortIcon column="name" />
                  </div>
                </th>
                <th
                  className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider cursor-pointer hover:bg-nuffle-gold/20 transition-colors"
                  onClick={() => handleSort("roster")}
                >
                  <div className="flex items-center gap-2">
                    Roster <SortIcon column="roster" />
                  </div>
                </th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                Ruleset
              </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Propriétaire
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Valeur
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Joueurs
                </th>
                <th
                  className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider cursor-pointer hover:bg-nuffle-gold/20 transition-colors"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center gap-2">
                    Créée le <SortIcon column="createdAt" />
                  </div>
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teams.map((team) => (
                <tr
                  key={team.id}
                  data-testid={`admin-team-row-${team.id}`}
                  className={`cursor-pointer transition-colors duration-150 ${
                    team.deletedAt ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-gray-50"
                  }`}
                  onClick={() => router.push(`/admin/teams/${team.id}`)}
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={team.deletedAt ? "line-through text-gray-500" : ""}>
                        {team.name}
                      </span>
                      {team.deletedAt && (
                        <span
                          data-testid={`admin-team-deleted-badge-${team.id}`}
                          title={`Supprimée le ${new Date(team.deletedAt).toLocaleString("fr-FR")}`}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                        >
                          Supprimée
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {team.roster}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      {team.ruleset === "season_3" ? "Saison 3" : "Saison 2"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {team.owner.coachName || team.owner.name || "—"}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {team.owner.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {formatCurrency(team.teamValue || team.currentValue || 0)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Trésor: {formatCurrency(team.treasury)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3 text-xs text-gray-600">
                      <span title="Joueurs">👥 {team._count.players}</span>
                      {team._count.starPlayers > 0 && (
                        <span title="Star Players">⭐ {team._count.starPlayers}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(team.createdAt).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {/* La fiche complète est une PAGE (`/admin/teams/[id]`)
                          et non une modale : elle se partage par URL, se
                          recharge, et a la place d'afficher un roster entier
                          avec positions et compétences lisibles. */}
                      <Link
                        data-testid={`admin-team-open-${team.id}`}
                        href={`/admin/teams/${team.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
                        title="Voir la fiche complète"
                      >
                        <span>👁️</span>
                        <span>Voir</span>
                      </Link>
                      {/* Journal d'équipe : la frise complète des mutations
                          (trésorerie, VE, roster) avec l'auteur de chacune.
                          L'endpoint autorise les admins sur n'importe quelle
                          équipe. */}
                      <a
                        data-testid="admin-team-journal-link"
                        href={`/me/teams/${team.id}/journal`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-xs font-medium"
                        title="Journal des modifications"
                      >
                        <span>📜</span>
                        <span>Journal</span>
                      </a>
                      {/* Une equipe supprimee ne se re-supprime pas : le
                          bouton bascule en restauration, seule action qui a
                          du sens dans cet etat. */}
                      {team.deletedAt ? (
                        <button
                          data-testid={`admin-team-restore-${team.id}`}
                          onClick={() => handleRestore(team.id, team.name)}
                          disabled={actionLoading === team.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors text-xs font-medium"
                          title="Restaurer"
                        >
                          <span>{actionLoading === team.id ? "⏳" : "♻️"}</span>
                          <span>Restaurer</span>
                        </button>
                      ) : (
                        <button
                          data-testid={`admin-team-delete-${team.id}`}
                          onClick={() => handleDelete(team.id, team.name)}
                          disabled={actionLoading === team.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors text-xs font-medium"
                          title="Supprimer"
                        >
                          <span>{actionLoading === team.id ? "⏳" : "🗑️"}</span>
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-between items-center bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 font-medium">
            Page {pagination.page} sur {pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage === pagination.totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

