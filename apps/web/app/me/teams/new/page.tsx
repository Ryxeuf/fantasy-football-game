"use client";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../auth-client";
import StarPlayerSelector from "../../../components/StarPlayerSelector";
import SkillTooltip from "../components/SkillTooltip";
import { useLanguage } from "../../../contexts/LanguageContext";
import { DEFAULT_RULESET, RULESETS, type Ruleset, getRerollCost } from "@bb/game-engine";

type Position = {
  slug: string;
  displayName: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string;
};

type Roster = {
  slug: string;
  name: string;
};

export default function NewTeamBuilder() {
  const { t, language } = useLanguage();
  // Initialiser les valeurs directement depuis l'URL
  const [ruleset, setRuleset] = useState<Ruleset>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const value = urlParams.get("ruleset") as Ruleset | null;
      if (value && RULESETS.includes(value)) {
        return value;
      }
    }
    return DEFAULT_RULESET;
  });
  const [rosterId, setRosterId] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('roster') || "skaven";
    }
    return "skaven";
  });
  
  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('name') || "";
    }
    return "";
  });
  
  const [teamValue, setTeamValue] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const value = urlParams.get('teamValue');
      return value ? parseInt(value) : 1000;
    }
    return 1000;
  });
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedStarPlayers, setSelectedStarPlayers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loadingRosters, setLoadingRosters] = useState(true);

  const [rerolls, setRerolls] = useState(0);
  const [cheerleaders, setCheerleaders] = useState(0);
  const [assistants, setAssistants] = useState(0);
  const [apothecary, setApothecary] = useState(false);
  const [dedicatedFans, setDedicatedFans] = useState(1);

  // Charger la liste des rosters depuis l'API selon la langue
  useEffect(() => {
    const lang = language === "en" ? "en" : "fr";
    const API_BASE_PUBLIC = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';
    
    fetch(`${API_BASE_PUBLIC}/api/rosters?lang=${lang}&ruleset=${ruleset}`)
      .then((r) => r.json())
      .then((data) => {
        const rostersList = (data.rosters || []).map((r: { slug: string; name: string }) => ({
          slug: r.slug,
          name: r.name,
        }));
        setRosters(rostersList);
        setLoadingRosters(false);
        
        // Vérifier que le rosterId actuel est dans la liste, sinon utiliser le premier
        if (rostersList.length > 0) {
          setRosterId((currentRosterId) => {
            const currentRoster = rostersList.find((r: Roster) => r.slug === currentRosterId);
            return currentRoster ? currentRosterId : rostersList[0].slug;
          });
        }
      })
      .catch((err) => {
        console.error("Erreur lors du chargement des rosters:", err);
        setLoadingRosters(false);
      });
  }, [language, ruleset]);

  // Charger les positions du roster sélectionné
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const query = ruleset ? `?ruleset=${encodeURIComponent(ruleset)}` : "";
    fetch(`${API_BASE}/team/rosters/${rosterId}${query}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    })
      .then((r) => r.json())
      .then((d) => {
        setPositions(d.roster.positions || []);
        const init: Record<string, number> = {};
        (d.roster.positions || []).forEach((p: Position) => {
          init[p.slug] = p.min || 0;
        });
        setCounts(init);
      })
      .catch(() => setError(t.teams.errorLoadingRoster));
  }, [rosterId, ruleset, t]);

  const total = useMemo(
    () =>
      Object.entries(counts).reduce(
        (acc, [k, c]) =>
          acc + (positions.find((p) => p.slug === k)?.cost || 0) * (c || 0),
        0,
      ),
    [counts, positions],
  );
  const totalPlayers = useMemo(
    () => Object.values(counts).reduce((a, b) => a + (b || 0), 0),
    [counts],
  );

  // Calculer le coût des Star Players (sera mis à jour par le composant)
  const starPlayersCost = useMemo(() => {
    // Le coût sera calculé dans le composant StarPlayerSelector
    // Pour l'instant on ne l'utilise pas ici car le composant gère déjà la validation
    return 0;
  }, [selectedStarPlayers]);

  const totalPlayersWithStars = useMemo(
    () => totalPlayers + selectedStarPlayers.length,
    [totalPlayers, selectedStarPlayers],
  );

  const rerollUnitCost = useMemo(() => getRerollCost(rosterId) / 1000, [rosterId]);
  const staffCost = useMemo(
    () =>
      rerolls * rerollUnitCost +
      cheerleaders * 10 +
      assistants * 10 +
      (apothecary ? 50 : 0) +
      Math.max(0, dedicatedFans - 1) * 10,
    [rerolls, rerollUnitCost, cheerleaders, assistants, apothecary, dedicatedFans],
  );
  const remainingBudget = teamValue - total - staffCost;

  const rulesetLabels: Record<Ruleset, string> = {
    season_2: t.teams.rulesetSeason2 ?? "Saison 2",
    season_3: t.teams.rulesetSeason3 ?? "Saison 3",
  };

  function change(slug: string, delta: number) {
    setCounts((prev) => {
      const pos = positions.find((p) => p.slug === slug);
      const currentCount = prev[slug] || 0;
      const next = Math.max(
        pos?.min ?? 0,
        Math.min(pos?.max ?? 16, currentCount + delta),
      );
      
      return { ...prev, [slug]: next };
    });
  }

  async function submit() {
    try {
      setError(null);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/team/build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          name,
          roster: rosterId,
          teamValue,
          ruleset,
          choices: Object.entries(counts).map(([slug, count]) => ({
            key: slug,
            count,
          })),
          starPlayers: selectedStarPlayers,
          rerolls,
          cheerleaders,
          assistants,
          apothecary,
          dedicatedFans,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `${t.teams.error} ${res.status}`);
      window.location.href = `/me/teams/${json.team.id}`;
    } catch (e: any) {
      setError(e.message || t.teams.error);
    }
  }

  return (
    <div className="w-full p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t.teams.createTeamTitle}</h1>
      {error && <p data-testid="team-builder-error" className="text-red-600 text-sm">{error}</p>}
      <div className="grid gap-3">
        <input
          data-testid="team-name-input"
          className="border p-2 rounded"
          placeholder={t.teams.teamNamePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-3 flex-wrap">
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.teams.rulesetLabel}
            </label>
            <select
              data-testid="ruleset-select"
              className="border p-2 w-full rounded"
              value={ruleset}
              onChange={(e) => setRuleset(e.target.value as Ruleset)}
            >
              {RULESETS.map((value) => (
                <option key={value} value={value}>
                  {rulesetLabels[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.teams.roster}
            </label>
            <select
              data-testid="roster-select"
              className="border p-2 w-full rounded"
              value={rosterId}
              onChange={(e) => setRosterId(e.target.value)}
              disabled={loadingRosters}
            >
              {loadingRosters ? (
                <option value="">{t.common.loading}</option>
              ) : (
                rosters.map((roster) => (
                  <option key={roster.slug} value={roster.slug}>
                    {roster.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.teams.teamValue}
            </label>
            <input
              type="number"
              min="100"
              max="2000"
              step="50"
              className="border p-2 w-full rounded"
              value={teamValue}
              onChange={(e) => setTeamValue(parseInt(e.target.value) || 1000)}
            />
          </div>
        </div>
      </div>
      <div className="rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">{t.teams.position}</th>
              <th className="text-left p-2">{t.teams.cost}</th>
              <th className="text-left p-2">{t.teams.min}</th>
              <th className="text-left p-2">{t.teams.max}</th>
              <th className="text-left p-2">{t.teams.skills}</th>
              <th className="text-left p-2">{t.teams.quantity}</th>
              <th className="text-left p-2">{t.teams.actions}</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.slug} className="odd:bg-white even:bg-gray-50">
                <td className="p-2">{p.displayName}</td>
                <td className="p-2">{p.cost}k</td>
                <td className="p-2">{p.min}</td>
                <td className="p-2">{p.max}</td>
                <td className="p-2">
                  <SkillTooltip 
                    skillsString={p.skills} 
                    position={p.slug}
                    className="text-xs"
                  />
                </td>
                <td className="p-2">{counts[p.slug] || 0}</td>
                <td className="p-2">
                  <button
                    data-testid={`position-remove-${p.slug}`}
                    className="px-2 py-1 border mr-2 rounded hover:bg-gray-100 transition-colors"
                    onClick={() => change(p.slug, -1)}
                    disabled={(counts[p.slug] || 0) <= (p.min || 0)}
                  >
                    -
                  </button>
                  <button
                    data-testid={`position-add-${p.slug}`}
                    className={`px-2 py-1 border rounded ${
                      (counts[p.slug] || 0) >= (p.max || 16) ||
                      total + staffCost + p.cost > teamValue
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'hover:bg-gray-100 transition-colors'
                    }`}
                    onClick={() => change(p.slug, 1)}
                    disabled={(counts[p.slug] || 0) >= (p.max || 16) || total + staffCost + p.cost > teamValue}
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StarPlayerSelector
        roster={rosterId}
        ruleset={ruleset}
        selectedStarPlayers={selectedStarPlayers}
        onSelectionChange={setSelectedStarPlayers}
        currentPlayerCount={totalPlayers}
        availableBudget={Math.max(0, (teamValue - total - staffCost) * 1000)}
      />

      <div className="rounded border bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold">{t.teams.teamInfo ?? "Staff"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.teams.rerolls} ({rerollUnitCost}{t.teams.kpo})
            </label>
            <input
              data-testid="staff-rerolls"
              type="number"
              min={0}
              max={8}
              value={rerolls}
              onChange={(e) => setRerolls(Math.max(0, Math.min(8, parseInt(e.target.value) || 0)))}
              className="border p-2 w-full rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.teams.cheerleaders} (10{t.teams.kpo})
            </label>
            <input
              data-testid="staff-cheerleaders"
              type="number"
              min={0}
              max={12}
              value={cheerleaders}
              onChange={(e) => setCheerleaders(Math.max(0, Math.min(12, parseInt(e.target.value) || 0)))}
              className="border p-2 w-full rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.teams.assistants} (10{t.teams.kpo})
            </label>
            <input
              data-testid="staff-assistants"
              type="number"
              min={0}
              max={6}
              value={assistants}
              onChange={(e) => setAssistants(Math.max(0, Math.min(6, parseInt(e.target.value) || 0)))}
              className="border p-2 w-full rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.teams.dedicatedFans} (10{t.teams.kpo})
            </label>
            <input
              data-testid="staff-dedicated-fans"
              type="number"
              min={1}
              max={6}
              value={dedicatedFans}
              onChange={(e) => setDedicatedFans(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
              className="border p-2 w-full rounded"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              data-testid="staff-apothecary"
              type="checkbox"
              checked={apothecary}
              onChange={(e) => setApothecary(e.target.checked)}
              className="h-4 w-4"
            />
            <label className="text-sm text-gray-700">
              {t.teams.apothecary} (50{t.teams.kpo})
            </label>
          </div>
        </div>
        <div className="text-sm text-gray-600" data-testid="staff-cost">
          {t.teams.staffCost ?? "Coût staff"} : {staffCost}{t.teams.kpo}
        </div>
      </div>

      <div className="rounded border bg-gray-50 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3 text-sm">
          <div>
            <div className="text-gray-600">{t.teams.playersCost}</div>
            <div className="font-semibold text-lg">{total}{t.teams.kpo}</div>
          </div>
          <div>
            <div className="text-gray-600">{t.teams.staffCost ?? "Coût staff"}</div>
            <div className="font-semibold text-lg" data-testid="staff-cost-summary">{staffCost}{t.teams.kpo}</div>
          </div>
          <div>
            <div className="text-gray-600">{t.teams.totalBudget}</div>
            <div className="font-semibold text-lg">{teamValue}{t.teams.kpo}</div>
          </div>
          <div>
            <div className="text-gray-600">{t.teams.remainingBudget}</div>
            <div
              data-testid="remaining-budget"
              className={`font-semibold text-lg ${remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {remainingBudget}{t.teams.kpo}
            </div>
          </div>
          <div>
            <div className="text-gray-600">{t.teams.totalPlayers}</div>
            <div className={`font-semibold text-lg ${totalPlayersWithStars < 11 || totalPlayersWithStars > 16 ? 'text-red-600' : 'text-green-600'}`}>
              {totalPlayersWithStars} / 16
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex-1">
            {totalPlayersWithStars < 11 && (
              <div className="text-red-600 text-sm">
                ⚠️ {t.teams.needMinPlayers.replace("{count}", totalPlayersWithStars.toString())}
              </div>
            )}
            {totalPlayersWithStars > 16 && (
              <div className="text-red-600 text-sm">
                ⚠️ {t.teams.maxPlayersExceeded.replace("{count}", totalPlayersWithStars.toString())}
              </div>
            )}
            {totalPlayersWithStars >= 11 && totalPlayersWithStars <= 16 && (
              <div className="text-green-600 text-sm">
                ✅ {t.teams.validTeam.replace("{players}", totalPlayers.toString()).replace("{stars}", selectedStarPlayers.length.toString())}
              </div>
            )}
          </div>
          <button
            data-testid="create-team-submit"
            className="px-6 py-3 bg-emerald-600 text-white rounded font-medium disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            onClick={submit}
            disabled={totalPlayersWithStars < 11 || totalPlayersWithStars > 16 || remainingBudget < 0}
          >
            {t.teams.createTeamButton}
          </button>
        </div>
      </div>
    </div>
  );
}
