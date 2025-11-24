"use client";
import { useEffect, useState, useCallback } from "react";
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

type TeamDetails = Team & {
  players: Array<{
    id: string;
    name: string;
    position: string;
    number: number;
    ma: number;
    st: number;
    ag: number;
    pa: number;
    av: number;
    skills: string;
  }>;
  starPlayers: Array<{
    id: string;
    starPlayerSlug: string;
    cost: number;
    hiredAt: string;
  }>;
};

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
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamDetails, setTeamDetails] = useState<TeamDetails | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
      });
      const data = await fetchJSON(`/admin/teams?${params}`);
      setTeams(data.teams);
      setPagination(data.pagination);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortBy, sortOrder, search, rosterFilter, ownerFilter]);

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
    if (
      !confirm(
        `⚠️ ATTENTION: Voulez-vous vraiment supprimer l'équipe "${teamName}" ?\n\nCette action est irréversible et supprimera tous les joueurs associés.`,
      )
    ) {
      return;
    }
    setActionLoading(teamId);
    try {
      await fetchJSON(`/admin/teams/${teamId}`, {
        method: "DELETE",
      });
      await loadTeams();
      if (selectedTeam === teamId) {
        setSelectedTeam(null);
        setTeamDetails(null);
      }
    } catch (e: any) {
      alert(e.message || "Erreur lors de la suppression");
    } finally {
      setActionLoading(null);
    }
  };

  const loadTeamDetails = async (teamId: string) => {
    setSelectedTeam(teamId);
    try {
      const data = await fetchJSON(`/admin/teams/${teamId}`);
      setTeamDetails(data.team);
    } catch (e: any) {
      alert(e.message || "Erreur lors du chargement des détails");
      setSelectedTeam(null);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            ⚽ Gestion des Équipes
          </h1>
          <p className="text-sm text-gray-600">
            Gérez toutes les équipes de la plateforme
          </p>
        </div>
        {pagination && (
          <div className="text-sm text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-200">
            {pagination.total} équipe{pagination.total !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex-1 min-w-[200px]">
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
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white min-w-[150px]"
          />
          <select
            value={rosterFilter}
            onChange={(e) => {
              setRosterFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
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
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
          >
            <option value="">Tous les rulesets</option>
            <option value="season_2">Saison 2</option>
            <option value="season_3">Saison 3</option>
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
          <div className="p-8 text-center text-gray-500">Aucune équipe trouvée</div>
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
                  className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                  onClick={() => loadTeamDetails(team.id)}
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {team.name}
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
                    <button
                      onClick={() => handleDelete(team.id, team.name)}
                      disabled={actionLoading === team.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors text-xs font-medium"
                      title="Supprimer"
                    >
                      <span>{actionLoading === team.id ? "⏳" : "🗑️"}</span>
                      <span>Supprimer</span>
                    </button>
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

      {/* Modal de détails */}
      {selectedTeam && teamDetails && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setSelectedTeam(null);
            setTeamDetails(null);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl max-h-[90vh] overflow-y-auto w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-heading font-bold text-nuffle-anthracite">
                ⚽ Détails de l'équipe
              </h2>
              <button
                onClick={() => {
                  setSelectedTeam(null);
                  setTeamDetails(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Informations générales</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Nom:</span>{" "}
                    <span className="font-medium">{teamDetails.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Roster:</span>{" "}
                    <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                      {teamDetails.roster}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Propriétaire:</span>{" "}
                    <span className="font-medium">
                      {teamDetails.owner.coachName || teamDetails.owner.name || teamDetails.owner.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>{" "}
                    <span className="font-mono text-xs">{teamDetails.owner.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Valeur d'équipe:</span>{" "}
                    <span className="font-medium">{formatCurrency(teamDetails.teamValue || teamDetails.currentValue || 0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Trésor:</span>{" "}
                    <span className="font-medium">{formatCurrency(teamDetails.treasury)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Budget initial:</span>{" "}
                    <span className="font-medium">{formatCurrency(teamDetails.initialBudget)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Créée le:</span>{" "}
                    {new Date(teamDetails.createdAt).toLocaleString("fr-FR")}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Équipement</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-gray-600">Relances</div>
                    <div className="text-2xl font-bold">{teamDetails.rerolls}</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-gray-600">Pom-pom girls</div>
                    <div className="text-2xl font-bold">{teamDetails.cheerleaders}</div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded">
                    <div className="text-gray-600">Assistants</div>
                    <div className="text-2xl font-bold">{teamDetails.assistants}</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <div className="text-gray-600">Fans dévoués</div>
                    <div className="text-2xl font-bold">{teamDetails.dedicatedFans}</div>
                  </div>
                </div>
                {teamDetails.apothecary && (
                  <div className="mt-2 text-sm text-green-700 font-medium">
                    ✓ Apothicaire disponible
                  </div>
                )}
              </div>

              {teamDetails.players.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Joueurs ({teamDetails.players.length})</h3>
                  <div className="border rounded overflow-hidden max-h-96 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left p-2">#</th>
                          <th className="text-left p-2">Nom</th>
                          <th className="text-left p-2">Position</th>
                          <th className="text-left p-2">MA</th>
                          <th className="text-left p-2">ST</th>
                          <th className="text-left p-2">AG</th>
                          <th className="text-left p-2">PA</th>
                          <th className="text-left p-2">AV</th>
                          <th className="text-left p-2">Compétences</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamDetails.players.map((player) => (
                          <tr key={player.id} className="odd:bg-white even:bg-gray-50">
                            <td className="p-2 font-medium">{player.number}</td>
                            <td className="p-2">{player.name}</td>
                            <td className="p-2 text-xs text-gray-600">{player.position}</td>
                            <td className="p-2">{player.ma}</td>
                            <td className="p-2">{player.st}</td>
                            <td className="p-2">{player.ag}</td>
                            <td className="p-2">{player.pa}</td>
                            <td className="p-2">{player.av}</td>
                            <td className="p-2 text-xs text-gray-600">
                              {player.skills || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {teamDetails.starPlayers.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Star Players ({teamDetails.starPlayers.length})</h3>
                  <div className="border rounded overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2">Slug</th>
                          <th className="text-left p-2">Coût</th>
                          <th className="text-left p-2">Recruté le</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamDetails.starPlayers.map((sp) => (
                          <tr key={sp.id} className="odd:bg-white even:bg-gray-50">
                            <td className="p-2 font-mono text-xs">{sp.starPlayerSlug}</td>
                            <td className="p-2">{formatCurrency(sp.cost)}</td>
                            <td className="p-2 text-xs text-gray-600">
                              {new Date(sp.hiredAt).toLocaleDateString("fr-FR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

