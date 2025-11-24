"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../auth-client";
import SkillTooltip from "../components/SkillTooltip";
import TeamInfoDisplay from "../components/TeamInfoDisplay";
import { getPlayerCost, getDisplayName, getRerollCost } from "@bb/game-engine";
import { exportTeamToPDF, exportSkillsSheet, exportMatchSheet } from "../utils/exportPDF";
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

export default function TeamDetailPage() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [userName, setUserName] = useState<string>("");
  const [rosterName, setRosterName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const rulesetLabels: Record<string, string> = {
    season_2: t.teams.rulesetSeason2 ?? "Saison 2",
    season_3: t.teams.rulesetSeason3 ?? "Saison 3",
  };
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
        
        // Charger le nom du roster depuis l'API selon la langue
        if (d?.team?.roster) {
          const lang = language === "en" ? "en" : "fr";
          try {
            const rulesetQuery = d.team.ruleset ? `&ruleset=${encodeURIComponent(d.team.ruleset)}` : "";
            const rosterResponse = await fetch(`${API_BASE}/api/rosters/${d.team.roster}?lang=${lang}${rulesetQuery}`);
            if (rosterResponse.ok) {
              const rosterData = await rosterResponse.json();
              setRosterName(rosterData.roster?.name || d.team.roster);
            } else {
              setRosterName(d.team.roster);
            }
          } catch {
            setRosterName(d.team.roster);
          }
        }
      } catch (e: any) {
        setError(e.message || t.teams.error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t, language]);

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

  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const handleExportRoster = async () => {
    if (!team) return;
    try {
      await exportTeamToPDF(team, getPlayerCost, userName, language);
      setExportMenuOpen(false);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert(t.teams.exportPDFError);
    }
  };

  const handleExportSkills = async () => {
    if (!team) return;
    try {
      await exportSkillsSheet(team, language);
      setExportMenuOpen(false);
    } catch (error) {
      console.error('Erreur lors de l\'export des compétences:', error);
      alert(t.teams.exportPDFError);
    }
  };

  const handleExportMatch = async () => {
    if (!team) return;
    try {
      await exportMatchSheet(team, undefined, language);
      setExportMenuOpen(false);
    } catch (error) {
      console.error('Erreur lors de l\'export de la feuille de match:', error);
      alert(t.teams.exportPDFError);
    }
  };

  const team = data?.team;
  const match = data?.currentMatch;
  const localMatchStats = data?.localMatchStats;
  const canEdit = !match || (match.status !== "pending" && match.status !== "active");

  if (loading) {
    return (
      <div className="w-full p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">{team?.name || t.teams.team}</h1>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">
            {t.teams.roster}: <span className="font-semibold">{rosterName || team?.roster || ''}</span>
          </div>
          {team?.ruleset && (
            <div className="text-xs sm:text-sm text-emerald-700 font-semibold mt-1 uppercase tracking-wide">
              {t.teams.rulesetBadge.replace(
                "{label}",
                rulesetLabels[team.ruleset] || team.ruleset,
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {canEdit ? (
            <a
              href={`/me/teams/${id}/edit`}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-center"
            >
              {t.teams.modifyTeam}
            </a>
          ) : (
            <div className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-gray-300 text-gray-600 rounded cursor-not-allowed text-center">
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
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <span className="hidden sm:inline">{t.teams.exportOptions}</span>
              <span className="sm:hidden">📥</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {exportMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setExportMenuOpen(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <div className="py-1">
                    <button
                      onClick={handleExportRoster}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {t.teams.exportRosterPDF}
                    </button>
                    <button
                      onClick={handleExportSkills}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {t.teams.exportSkillsSheet}
                    </button>
                    {/* Bouton d'export de la feuille de match masqué temporairement */}
                    {/* <button
                      onClick={handleExportMatch}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {t.teams.exportMatchSheet}
                    </button> */}
                  </div>
                </div>
              </>
            )}
          </div>
          <a
            href="/me/teams"
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors border border-gray-500 text-center"
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
            <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
              <h2 className="text-base sm:text-lg font-semibold">{t.teams.budgetSummary}</h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-xs sm:text-sm text-blue-600 font-medium">{t.teams.initialBudget}</div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-900">
                    {team.initialBudget?.toLocaleString()}{t.teams.kpo}
                  </div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-xs sm:text-sm text-green-600 font-medium">{t.teams.currentCost}</div>
                  <div className="text-xl sm:text-2xl font-bold text-green-900">
                    {Math.round((team.players?.reduce((total: number, player: any) => 
                      total + getPlayerCost(player.position, team.roster), 0) || 0) / 1000)}{t.teams.kpo}
                  </div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-xs sm:text-sm text-purple-600 font-medium">{t.teams.teamValue}</div>
                  <div className="text-xl sm:text-2xl font-bold text-purple-900">
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
                    <div className={`text-center p-3 sm:p-4 rounded-lg border ${positive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className={`text-xs sm:text-sm font-medium ${
                    positive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {t.teams.remainingBudget}
                  </div>
                  <div className={`text-xl sm:text-2xl font-bold ${positive ? 'text-green-900' : 'text-red-900'}`}>
                    {Math.round(remaining / 1000)}{t.teams.kpo}
                  </div>
                </div>
                  );
                })()}
              </div>
              <div className="mt-3 sm:mt-4 text-xs text-gray-500">
                <p><strong>{t.teams.initialBudget}</strong> : {t.teams.initialBudgetDesc}</p>
                <p><strong>{t.teams.currentCost}</strong> : {t.teams.currentCostDesc}</p>
                <p><strong>{t.teams.teamValue}</strong> : {t.teams.teamValueDesc}</p>
                <p><strong>{t.teams.remainingBudget}</strong> : {t.teams.remainingBudgetDesc}</p>
              </div>
            </div>
          </div>

          {/* Statistiques de l'équipe */}
          {localMatchStats && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
                <h2 className="text-base sm:text-lg font-semibold">
                  {t.teams.teamStatsTitle}
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs sm:text-sm text-blue-600 font-medium">
                      {t.teams.teamStatsLocalMatches}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-blue-900">
                      {localMatchStats.total}
                    </div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-xs sm:text-sm text-green-600 font-medium">
                      {t.teams.teamStatsCompleted}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-green-900">
                      {localMatchStats.completed}
                    </div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-xs sm:text-sm text-purple-600 font-medium">
                      {t.teams.teamStatsRecord}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-purple-900 font-mono">
                      {localMatchStats.wins} / {localMatchStats.draws} / {localMatchStats.losses}
                    </div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-xs sm:text-sm text-orange-600 font-medium">
                      {t.teams.teamStatsTouchdowns}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-orange-900 font-mono">
                      {localMatchStats.touchdownsFor} / {localMatchStats.touchdownsAgainst}{" "}
                      <span className="text-sm">
                        ({localMatchStats.touchdownDiff >= 0 ? "+" : ""}
                        {localMatchStats.touchdownDiff})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
              <h2 className="text-base sm:text-lg font-semibold">{t.teams.teamComposition}</h2>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                {team.players?.length || 0} {t.teams.players}
              </div>
              <div className="text-xs text-gray-500 mt-2 hidden sm:block">
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
              {/* Version desktop : tableau */}
              <table className="min-w-full hidden md:table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">{t.teams.tableNumber}</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">{t.teams.tableName}</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">{t.teams.tablePosition}</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">{t.teams.tableCost}</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">MA</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">ST</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">AG</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">PA</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">AV</th>
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">{t.teams.tableSkills}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {team.players?.sort((a: any, b: any) => a.number - b.number).map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-3 sm:p-4 font-mono text-base sm:text-lg font-semibold">{p.number}</td>
                      <td className="p-3 sm:p-4 font-medium text-sm sm:text-base">{p.name}</td>
                      <td className="p-3 sm:p-4 text-gray-600 text-xs sm:text-sm">{getDisplayName(p.position)}</td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">
                        {Math.round(getPlayerCost(p.position, team.roster) / 1000)}{t.teams.kpo}
                      </td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">{p.ma}</td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">{p.st}</td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">{p.ag}</td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">{p.pa}</td>
                      <td className="p-3 sm:p-4 text-center font-mono text-xs sm:text-sm">{p.av}</td>
                      <td className="p-3 sm:p-4">
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
              
              {/* Version mobile : cartes */}
              <div className="md:hidden space-y-3 p-4">
                {team.players?.sort((a: any, b: any) => a.number - b.number).map((p: any) => (
                  <div key={p.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xl font-bold text-gray-900">{p.number}</span>
                        <div>
                          <div className="font-semibold text-base">{p.name}</div>
                          <div className="text-xs text-gray-600">{getDisplayName(p.position)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">{t.teams.tableCost}</div>
                        <div className="font-mono text-sm font-semibold">
                          {Math.round(getPlayerCost(p.position, team.roster) / 1000)}{t.teams.kpo}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2 mb-3 text-xs">
                      <div className="text-center">
                        <div className="text-gray-500">MA</div>
                        <div className="font-mono font-semibold">{p.ma}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">ST</div>
                        <div className="font-mono font-semibold">{p.st}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">AG</div>
                        <div className="font-mono font-semibold">{p.ag}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">PA</div>
                        <div className="font-mono font-semibold">{p.pa}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">AV</div>
                        <div className="font-mono font-semibold">{p.av}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">{t.teams.tableSkills}</div>
                      <SkillTooltip 
                        skillsString={p.skills} 
                        teamName={team.roster}
                        position={p.position}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {match && (
            <div className="bg-white rounded-lg border p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-base sm:text-lg">{t.teams.matchInProgress}</div>
                  <div className="text-xs sm:text-sm text-gray-600 mt-1">
                    {t.teams.matchID}: {match.id} • {t.teams.status}: {match.status} •{" "}
                    {new Date(match.createdAt).toLocaleString()}
                  </div>
                </div>
                <a
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-center text-sm sm:text-base"
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
