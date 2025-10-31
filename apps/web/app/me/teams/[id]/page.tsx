"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../auth-client";
import SkillTooltip from "../components/SkillTooltip";
import TeamInfoDisplay from "../components/TeamInfoDisplay";
import { getPlayerCost, getDisplayName, getRerollCost } from "@bb/game-engine";
import { exportTeamToPDF } from "../utils/exportPDF";
import { useLanguage } from "../../../contexts/LanguageContext";

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
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [userName, setUserName] = useState<string>("");
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
        setUserName(me.user.name || me.user.username || me.user.email || "");
        const d = await fetchJSON(`/team/${id}`);
        setData(d);
      } catch (e: any) {
        setError(e.message || t.teams.error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/team/${id}/recalculate`, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || `${t.teams.error} ${res.status}`);
      }
      
      const result = await res.json();
      // Mettre à jour les données en conservant currentMatch si présent
      setData((prev: any) => ({
        ...prev,
        team: result.team
      }));
      alert(result.message);
    } catch (e: any) {
      alert(`${t.teams.error}: ${e.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!team) return;
    try {
      await exportTeamToPDF(team, getPlayerCost, userName);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert(t.teams.exportPDFError);
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
          <h1 className="text-3xl font-bold">{team?.name || t.teams.team}</h1>
          <div className="text-sm text-gray-600 mt-1">
            {t.teams.roster}: <span className="font-semibold">{getRosterDisplayName(team?.roster || '')}</span>
          </div>
        </div>
        <div className="flex gap-3">
          {canEdit ? (
            <a
              href={`/me/teams/${id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {t.teams.modifyTeam}
            </a>
          ) : (
            <div className="px-4 py-2 bg-gray-300 text-gray-600 rounded cursor-not-allowed">
              {t.teams.teamInMatch}
            </div>
          )}
          {/* Bouton temporairement caché */}
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="hidden px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {recalculating ? t.teams.recalculating : t.teams.recalculateVE}
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            {t.teams.exportPDF}
          </button>
          <a
            href="/me/teams"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors border border-gray-500"
          >
            {t.teams.back}
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
          <div className="font-semibold">{t.teams.teamEngagedInMatch}</div>
          <div className="text-sm mt-1">
            {t.teams.teamEngagedDescription.replace("{status}", match.status)}
          </div>
          <a
            href="/play"
            className="mt-2 inline-block px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            {t.teams.goToMatch}
          </a>
        </div>
      )}

      {team && (
        <>
          {/* Résumé du budget */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <h2 className="text-lg font-semibold">{t.teams.budgetSummary}</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-600 font-medium">{t.teams.initialBudget}</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {team.initialBudget?.toLocaleString()}{t.teams.kpo}
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 font-medium">{t.teams.currentCost}</div>
                  <div className="text-2xl font-bold text-green-900">
                    {Math.round((team.players?.reduce((total: number, player: any) => 
                      total + getPlayerCost(player.position, team.roster), 0) || 0) / 1000)}{t.teams.kpo}
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-sm text-purple-600 font-medium">{t.teams.teamValue}</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {Math.round((team.teamValue || 0) / 1000)}{t.teams.kpo}
                  </div>
                </div>
                {(() => {
                  const playersCost = (team.players?.reduce((total: number, player: any) => 
                    total + getPlayerCost(player.position, team.roster), 0) || 0);
                  const rerolls = (team.rerolls || 0) * getRerollCost(team.roster || '');
                  const cheer = (team.cheerleaders || 0) * 10000;
                  const assistants = (team.assistants || 0) * 10000;
                  const apo = team.apothecary ? 50000 : 0;
                  const fans = Math.max(0, (team.dedicatedFans || 1) - 1) * 10000;
                  const rosterTotal = playersCost + rerolls + cheer + assistants + apo + fans;
                  const remaining = (team.initialBudget || 0) * 1000 - rosterTotal;
                  const positive = remaining >= 0;
                  return (
                    <div className={`text-center p-4 rounded-lg border ${positive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className={`text-sm font-medium ${
                    positive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {t.teams.remainingBudget}
                  </div>
                  <div className={`text-2xl font-bold ${positive ? 'text-green-900' : 'text-red-900'}`}>
                    {Math.round(remaining / 1000)}{t.teams.kpo}
                  </div>
                </div>
                  );
                })()}
              </div>
              <div className="mt-4 text-xs text-gray-500">
                <p><strong>{t.teams.initialBudget}</strong> : {t.teams.initialBudgetDesc}</p>
                <p><strong>{t.teams.currentCost}</strong> : {t.teams.currentCostDesc}</p>
                <p><strong>{t.teams.teamValue}</strong> : {t.teams.teamValueDesc}</p>
                <p><strong>{t.teams.remainingBudget}</strong> : {t.teams.remainingBudgetDesc}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <h2 className="text-lg font-semibold">{t.teams.teamComposition}</h2>
              <div className="text-sm text-gray-600 mt-1">
                {team.players?.length || 0} {t.teams.players}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 border border-gray-300 bg-blue-100 rounded"></span>
                  {t.teams.baseSkillsLegend}
                </span>
                <span className="ml-4 inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-orange-400 bg-blue-100 rounded"></span>
                  {t.teams.acquiredSkillsLegend}
                </span>
                <div className="mt-1 text-xs text-gray-400">
                  {t.teams.skillColorsLegend}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-900">{t.teams.tableNumber}</th>
                    <th className="text-left p-4 font-medium text-gray-900">{t.teams.tableName}</th>
                    <th className="text-left p-4 font-medium text-gray-900">{t.teams.tablePosition}</th>
                    <th className="text-left p-4 font-medium text-gray-900">{t.teams.tableCost}</th>
                    <th className="text-left p-4 font-medium text-gray-900">MA</th>
                    <th className="text-left p-4 font-medium text-gray-900">ST</th>
                    <th className="text-left p-4 font-medium text-gray-900">AG</th>
                    <th className="text-left p-4 font-medium text-gray-900">PA</th>
                    <th className="text-left p-4 font-medium text-gray-900">AV</th>
                    <th className="text-left p-4 font-medium text-gray-900">{t.teams.tableSkills}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {team.players?.sort((a: any, b: any) => a.number - b.number).map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-4 font-mono text-lg font-semibold">{p.number}</td>
                      <td className="p-4 font-medium">{p.name}</td>
                      <td className="p-4 text-gray-600">{getDisplayName(p.position)}</td>
                      <td className="p-4 text-center font-mono text-sm">
                        {Math.round(getPlayerCost(p.position, team.roster) / 1000)}{t.teams.kpo}
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
                  <div className="font-semibold text-lg">{t.teams.matchInProgress}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {t.teams.matchID}: {match.id} • {t.teams.status}: {match.status} •{" "}
                    {new Date(match.createdAt).toLocaleString()}
                  </div>
                </div>
                <a
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  href="/play"
                >
                  {t.teams.goToPlay}
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
