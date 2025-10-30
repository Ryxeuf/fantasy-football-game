"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../auth-client";
import SkillTooltip from "../components/SkillTooltip";
import TeamInfoDisplay from "../components/TeamInfoDisplay";
import { getPlayerCost, getDisplayName } from "@bb/game-engine";
import { exportTeamToPDF } from "../utils/exportPDF";

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

// Mapping des slugs de rosters vers leurs noms d'affichage
const ROSTER_DISPLAY_NAMES: Record<string, string> = {
  skaven: "Skaven",
  lizardmen: "Lizardmen",
  woodelf: "Wood Elf",
  wood_elf: "Wood Elf",
  "wood elf": "Wood Elf",
  darkelf: "Dark Elf",
  dark_elf: "Dark Elf",
  "dark elf": "Dark Elf",
  highelf: "High Elf",
  high_elf: "High Elf",
  "high elf": "High Elf",
  human: "Human",
  orc: "Orc",
  dwarf: "Dwarf",
  chaos: "Chaos",
  undead: "Undead",
  necromantic: "Necromantic Horror",
  norse: "Norse",
  amazon: "Amazon",
  elvenunion: "Elven Union",
  elven_union: "Elven Union",
  underworld: "Underworld Denizens",
  vampire: "Vampire",
  khorne: "Khorne",
  nurgle: "Nurgle",
  chaosdwarf: "Chaos Dwarf",
  chaos_dwarf: "Chaos Dwarf",
  goblin: "Goblin",
  halfling: "Halfling",
  ogre: "Ogre",
  snotling: "Snotling",
  blackorc: "Black Orc",
  black_orc: "Black Orc",
  chaosrenegades: "Chaos Renegades",
  chaos_renegades: "Chaos Renegades",
  oldworldalliance: "Old World Alliance",
  old_world_alliance: "Old World Alliance",
  tombkings: "Tomb Kings",
  tomb_kings: "Tomb Kings",
  imperial: "Imperial Nobility",
  gnome: "Gnome",
};

function getRosterDisplayName(slug: string): string {
  return ROSTER_DISPLAY_NAMES[slug] || slug;
}

export default function TeamDetailPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const id =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").pop()
      : "";

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const me = await fetchJSON("/auth/me");
        if (!me?.user) {
          window.location.href = "/login";
          return;
        }
        const d = await fetchJSON(`/team/${id}`);
        setData(d);
      } catch (e: any) {
        setError(e.message || "Erreur");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/teams/${id}/recalculate`, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || `Erreur ${res.status}`);
      }
      
      const result = await res.json();
      setData(result.team);
      alert(result.message);
    } catch (e: any) {
      alert(`Erreur: ${e.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!team) return;
    try {
      await exportTeamToPDF(team, getPlayerCost);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de la génération du PDF');
    }
  };

  const team = data?.team;
  const match = data?.currentMatch;
  const canEdit = !match || (match.status !== "pending" && match.status !== "active");

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{team?.name || "Équipe"}</h1>
          <div className="text-sm text-gray-600 mt-1">
            Roster: <span className="font-semibold">{getRosterDisplayName(team?.roster || '')}</span>
          </div>
        </div>
        <div className="flex gap-3">
          {canEdit ? (
            <a
              href={`/me/teams/${id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Modifier l'équipe
            </a>
          ) : (
            <div className="px-4 py-2 bg-gray-300 text-gray-600 rounded cursor-not-allowed">
              Équipe en match
            </div>
          )}
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {recalculating ? "Recalcul..." : "🔄 Recalculer VE"}
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            📄 Export PDF
          </button>
          <a
            href="/me/teams"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            Retour
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!canEdit && match && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <div className="font-semibold">⚠️ Équipe engagée dans un match</div>
          <div className="text-sm mt-1">
            Cette équipe est actuellement utilisée dans un match ({match.status}). 
            La modification n'est pas autorisée tant que le match n'est pas terminé.
          </div>
          <a
            href="/play"
            className="mt-2 inline-block px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Aller au match
          </a>
        </div>
      )}

      {team && (
        <>
          {/* Résumé du budget */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <h2 className="text-lg font-semibold">Résumé du budget</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-600 font-medium">Budget initial</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {team.initialBudget?.toLocaleString()}k po
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 font-medium">Coût actuel</div>
                  <div className="text-2xl font-bold text-green-900">
                    {Math.round((team.players?.reduce((total: number, player: any) => 
                      total + getPlayerCost(player.position, team.roster), 0) || 0) / 1000)}k po
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-sm text-purple-600 font-medium">VE (Valeur d'Équipe)</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {Math.round((team.teamValue || 0) / 1000)}k po
                  </div>
                </div>
                <div className={`text-center p-4 rounded-lg border ${
                  ((team.initialBudget || 0) * 1000 - (team.players?.reduce((total: number, player: any) => 
                    total + getPlayerCost(player.position, team.roster), 0) || 0)) >= 0 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className={`text-sm font-medium ${
                    ((team.initialBudget || 0) * 1000 - (team.players?.reduce((total: number, player: any) => 
                      total + getPlayerCost(player.position, team.roster), 0) || 0)) >= 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    Budget restant
                  </div>
                  <div className={`text-2xl font-bold ${
                    ((team.initialBudget || 0) * 1000 - (team.players?.reduce((total: number, player: any) => 
                      total + getPlayerCost(player.position, team.roster), 0) || 0)) >= 0 
                      ? 'text-green-900' 
                      : 'text-red-900'
                  }`}>
                    {Math.round(((team.initialBudget || 0) * 1000 - (team.players?.reduce((total: number, player: any) => 
                      total + getPlayerCost(player.position, team.roster), 0) || 0)) / 1000)}k po
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs text-gray-500">
                <p><strong>Budget initial</strong> : Montant saisi lors de la création de l'équipe</p>
                <p><strong>Coût actuel</strong> : Coût total des joueurs actuels</p>
                <p><strong>VE</strong> : Valeur d'Équipe calculée selon les règles Blood Bowl</p>
                <p><strong>Budget restant</strong> : Montant disponible pour ajouter des joueurs</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <h2 className="text-lg font-semibold">Composition de l'équipe</h2>
              <div className="text-sm text-gray-600 mt-1">
                {team.players?.length || 0} joueurs
              </div>
              <div className="text-xs text-gray-500 mt-2">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 border border-gray-300 bg-blue-100 rounded"></span>
                  Compétences de base (bordure grise)
                </span>
                <span className="ml-4 inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-orange-400 bg-blue-100 rounded"></span>
                  Compétences acquises (bordure orange)
                </span>
                <div className="mt-1 text-xs text-gray-400">
                  Couleurs de fond selon la catégorie : General (bleu), Agility (vert), Strength (rouge), Passing (violet), Mutation (orange), Trait (gris)
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-900">#</th>
                    <th className="text-left p-4 font-medium text-gray-900">Nom</th>
                    <th className="text-left p-4 font-medium text-gray-900">Position</th>
                    <th className="text-left p-4 font-medium text-gray-900">Coût</th>
                    <th className="text-left p-4 font-medium text-gray-900">MA</th>
                    <th className="text-left p-4 font-medium text-gray-900">ST</th>
                    <th className="text-left p-4 font-medium text-gray-900">AG</th>
                    <th className="text-left p-4 font-medium text-gray-900">PA</th>
                    <th className="text-left p-4 font-medium text-gray-900">AV</th>
                    <th className="text-left p-4 font-medium text-gray-900">Compétences</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {team.players?.sort((a: any, b: any) => a.number - b.number).map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-4 font-mono text-lg font-semibold">{p.number}</td>
                      <td className="p-4 font-medium">{p.name}</td>
                      <td className="p-4 text-gray-600">{getDisplayName(p.position)}</td>
                      <td className="p-4 text-center font-mono text-sm">
                        {Math.round(getPlayerCost(p.position, team.roster) / 1000)}k po
                      </td>
                      <td className="p-4 text-center font-mono">{p.ma}</td>
                      <td className="p-4 text-center font-mono">{p.st}</td>
                      <td className="p-4 text-center font-mono">{p.ag}</td>
                      <td className="p-4 text-center font-mono">{p.pa}</td>
                      <td className="p-4 text-center font-mono">{p.av}</td>
                      <td className="p-4">
                        <SkillTooltip 
                          skillsString={p.skills} 
                          teamName={team.roster}
                          position={p.position}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {match && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg">Partie en cours</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Match ID: {match.id} • Statut: {match.status} •{" "}
                    {new Date(match.createdAt).toLocaleString()}
                  </div>
                </div>
                <a
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  href="/play"
                >
                  Aller jouer
                </a>
              </div>
            </div>
          )}

          {/* Informations d'équipe */}
        <TeamInfoDisplay
          info={{
            treasury: team.treasury || 0,
            rerolls: team.rerolls || 0,
            cheerleaders: team.cheerleaders || 0,
            assistants: team.assistants || 0,
            apothecary: team.apothecary || false,
            dedicatedFans: team.dedicatedFans || 1,
            teamValue: team.teamValue || 0,
            currentValue: team.currentValue || 0,
            roster: team.roster,
          }}
        />
        </>
      )}
    </div>
  );
}
