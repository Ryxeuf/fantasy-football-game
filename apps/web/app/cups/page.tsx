"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../auth-client";
import { apiRequest } from "../lib/api-client";
import { RULESETS } from "@bb/game-engine";
import PendingCupInvitations from "./PendingCupInvitations";
import { getRosterName } from "@bb/game-engine";

type Cup = {
  id: string;
  name: string;
  description?: string | null;
  ruleset: string;
  format?: string;
  isAdjusted?: boolean;
  creator: {
    id: string;
    coachName: string;
    email: string;
  };
  creatorId: string;
  validated: boolean;
  isPublic: boolean;
  status: string; // "ouverte", "en_cours", "terminee", "archivee"
  participantCount: number;
  participants: Array<{
    id: string;
    name: string;
    roster: string;
    ruleset: string;
    owner: {
      id: string;
      coachName: string;
      email: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
  isCreator?: boolean;
  hasTeamParticipating?: boolean;
  scoringConfig?: {
    winPoints: number;
    drawPoints: number;
    lossPoints: number;
    forfeitPoints: number;
    touchdownPoints: number;
    blockCasualtyPoints: number;
    foulCasualtyPoints: number;
    passPoints: number;
  };
};

type Team = {
  id: string;
  name: string;
  roster: string;
  ruleset: string;
  createdAt: string;
};

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

async function postJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

export default function CupsPage() {
  const router = useRouter();
  const [cups, setCups] = useState<Cup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCupName, setNewCupName] = useState("");
  const [newCupIsPublic, setNewCupIsPublic] = useState(true);
  const [newCupRuleset, setNewCupRuleset] = useState<string>("season_3");
  const [newCupFormat, setNewCupFormat] = useState<string>("bb11");
  const [winPoints, setWinPoints] = useState(1000);
  const [drawPoints, setDrawPoints] = useState(400);
  const [lossPoints, setLossPoints] = useState(0);
  const [forfeitPoints, setForfeitPoints] = useState(-100);
  const [touchdownPoints, setTouchdownPoints] = useState(5);
  const [blockCasualtyPoints, setBlockCasualtyPoints] = useState(3);
  const [foulCasualtyPoints, setFoulCasualtyPoints] = useState(2);
  const [passPoints, setPassPoints] = useState(2);
  // Règles avancées de composition (mode coupe).
  const [newCupDescription, setNewCupDescription] = useState("");
  const [tierBudgets, setTierBudgets] = useState<Record<string, string>>({
    I: "",
    II: "",
    III: "",
    IV: "",
  });
  const [tierStartingPsp, setTierStartingPsp] = useState<Record<string, string>>({
    I: "",
    II: "",
    III: "",
    IV: "",
  });
  const [rosterOverrides, setRosterOverrides] = useState<
    Array<{ slug: string; budget: string }>
  >([]);
  const [rosterPspOverrides, setRosterPspOverrides] = useState<
    Array<{ slug: string; psp: string }>
  >([]);
  // Rosters du ruleset sélectionné (pour les menus déroulants d'override).
  const [availableRosters, setAvailableRosters] = useState<
    Array<{ slug: string; name: string }>
  >([]);
  const [creating, setCreating] = useState(false);
  const rulesetLabels: Record<string, string> = {
    season_2: "Saison 2",
    season_3: "Saison 3",
  };

  useEffect(() => {
    loadCups();
    loadTeams();
  }, []);

  // Charge les rosters du ruleset choisi pour alimenter les menus déroulants
  // des surcharges par roster (budget + PSP).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/builder-rosters?lang=fr&ruleset=${newCupRuleset}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data.rosters || []).map(
          (r: { slug: string; name: string }) => ({ slug: r.slug, name: r.name }),
        );
        setAvailableRosters(list);
      })
      .catch(() => {
        if (!cancelled) setAvailableRosters([]);
      });
    return () => {
      cancelled = true;
    };
  }, [newCupRuleset]);

  const loadTeams = async () => {
    try {
      const { teams: data } = await apiRequest<{ teams: Team[] }>("/team/mine");
      setTeams(data);
    } catch (e: any) {
      console.error("Erreur lors du chargement des équipes:", e);
    }
  };

  const loadCups = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      if (!me?.user) {
        window.location.href = "/login";
        return;
      }
      const { cups: data } = await fetchJSON("/cup");
      // Récupérer les équipes de l'utilisateur pour vérifier s'il a une équipe inscrite
      const { teams: userTeams } = await apiRequest<{ teams: Team[] }>(
        "/team/mine",
      );
      const userTeamIds = new Set(userTeams.map((t: Team) => t.id));
      
      // Enrichir avec les informations de l'utilisateur connecté
      const enrichedCups = data.map((cup: Cup) => ({
        ...cup,
        isCreator: cup.creatorId === me.user.id,
        hasTeamParticipating: cup.participants.some(
          (p) => userTeamIds.has(p.id),
        ),
      }));
      setCups(enrichedCups);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCupName.trim()) {
      setError("Le nom de la coupe est requis");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      // Convertit une map string→string en map string→number (entrées vides
      // ignorées). Renvoie undefined si vide (pas de contrainte).
      const toNumberMap = (
        src: Record<string, string>,
      ): Record<string, number> | undefined => {
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(src)) {
          const n = parseInt(v, 10);
          if (v.trim() !== "" && Number.isFinite(n) && n >= 0) out[k] = n;
        }
        return Object.keys(out).length > 0 ? out : undefined;
      };
      const overridesMap: Record<string, number> = {};
      for (const o of rosterOverrides) {
        const n = parseInt(o.budget, 10);
        if (o.slug.trim() && Number.isFinite(n) && n >= 0) {
          overridesMap[o.slug.trim()] = n;
        }
      }
      const pspOverridesMap: Record<string, number> = {};
      for (const o of rosterPspOverrides) {
        const n = parseInt(o.psp, 10);
        if (o.slug.trim() && Number.isFinite(n) && n >= 0) {
          pspOverridesMap[o.slug.trim()] = n;
        }
      }

      const response = await postJSON("/cup", {
        name: newCupName.trim(),
        description: newCupDescription.trim() || undefined,
        isPublic: newCupIsPublic,
        ruleset: newCupRuleset,
        format: newCupFormat,
        scoringConfig: {
          winPoints,
          drawPoints,
          lossPoints,
          forfeitPoints,
          touchdownPoints,
          blockCasualtyPoints,
          foulCasualtyPoints,
          passPoints,
        },
        // resurrectionMode : forcé côté serveur (seul mode disponible).
        tierBudgets: toNumberMap(tierBudgets),
        tierStartingPsp: toNumberMap(tierStartingPsp),
        rosterBudgetOverrides:
          Object.keys(overridesMap).length > 0 ? overridesMap : undefined,
        rosterStartingPspOverrides:
          Object.keys(pspOverridesMap).length > 0 ? pspOverridesMap : undefined,
      });
      setNewCupName("");
      setNewCupIsPublic(true);
      setWinPoints(1000);
      setDrawPoints(400);
      setLossPoints(0);
      setForfeitPoints(-100);
      setTouchdownPoints(5);
      setBlockCasualtyPoints(3);
      setFoulCasualtyPoints(2);
      setPassPoints(2);
      setNewCupDescription("");
      setNewCupFormat("bb11");
      setTierBudgets({ I: "", II: "", III: "", IV: "" });
      setTierStartingPsp({ I: "", II: "", III: "", IV: "" });
      setRosterOverrides([]);
      setRosterPspOverrides([]);
      setShowCreateForm(false);
      
      // Si la coupe est privée, rediriger vers la page de la coupe avec le lien
      if (!newCupIsPublic && response.cup) {
        router.push(`/cups/${response.cup.id}`);
      } else {
        loadCups();
      }
    } catch (e: any) {
      setError(e.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleValidate = async (cupId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir fermer les inscriptions de cette coupe ?")) {
      return;
    }
    setError(null);
    try {
      await postJSON(`/cup/${cupId}/validate`, {});
      loadCups();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la validation");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      <PendingCupInvitations />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            🏆 Coupes
          </h1>
          <p className="text-sm text-gray-600">
            Créez ou inscrivez-vous à une coupe
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/cups/archived"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-all"
          >
            📦 Coupes archivées
          </a>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <span>+</span>
            <span>Nouvelle coupe</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Créer une nouvelle coupe</h2>
          <form onSubmit={handleCreateCup} className="space-y-4">
            <div>
              <label htmlFor="cupName" className="block text-sm font-medium text-gray-700 mb-2">
                Nom de la coupe *
              </label>
              <input
                id="cupName"
                type="text"
                value={newCupName}
                onChange={(e) => setNewCupName(e.target.value)}
                placeholder="Ex: Coupe de Printemps 2024"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
                maxLength={100}
                required
              />
            </div>
            <div>
              <label htmlFor="cupDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-gray-400 font-normal">(optionnelle)</span>
              </label>
              <textarea
                id="cupDescription"
                value={newCupDescription}
                onChange={(e) => setNewCupDescription(e.target.value)}
                placeholder="Ex: Tournoi amical en résurrection, ouvert à tous les rosters T3."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
                rows={2}
                maxLength={1000}
                data-testid="cup-description-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ruleset
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
                value={newCupRuleset}
                onChange={(e) => setNewCupRuleset(e.target.value)}
              >
                {RULESETS.map((value) => (
                  <option key={value} value={value}>
                    {value === "season_3" ? "Saison 3" : "Saison 2"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
                value={newCupFormat}
                onChange={(e) => setNewCupFormat(e.target.value)}
                data-testid="cup-format-select"
              >
                <option value="bb11">Blood Bowl à 11</option>
                <option value="sevens">Blood Bowl à Sept</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Les équipes inscrites devront utiliser ce format.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  Points par résultat
                </h3>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Victoire
                    </label>
                    <input
                      type="number"
                      value={winPoints}
                      onChange={(e) => setWinPoints(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Nul
                    </label>
                    <input
                      type="number"
                      value={drawPoints}
                      onChange={(e) => setDrawPoints(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Défaite
                    </label>
                    <input
                      type="number"
                      value={lossPoints}
                      onChange={(e) => setLossPoints(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Forfait
                    </label>
                    <input
                      type="number"
                      value={forfeitPoints}
                      onChange={(e) => setForfeitPoints(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  Points par action
                </h3>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Touchdown
                    </label>
                    <input
                      type="number"
                      value={touchdownPoints}
                      onChange={(e) => setTouchdownPoints(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Sortie sur bloc
                    </label>
                    <input
                      type="number"
                      value={blockCasualtyPoints}
                      onChange={(e) =>
                        setBlockCasualtyPoints(Number(e.target.value))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Agression
                    </label>
                    <input
                      type="number"
                      value={foulCasualtyPoints}
                      onChange={(e) =>
                        setFoulCasualtyPoints(Number(e.target.value))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Passe
                    </label>
                    <input
                      type="number"
                      value={passPoints}
                      onChange={(e) => setPassPoints(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Règles avancées de composition (mode coupe) */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-800">
                Règles de composition
              </h3>
              <p className="text-xs text-gray-500 -mt-2">
                Les listes de rosters des surcharges dépendent du ruleset de la
                coupe (actuellement :{" "}
                <span className="font-medium">
                  {rulesetLabels[newCupRuleset] || newCupRuleset}
                </span>
                ).
              </p>

              <p className="text-xs text-gray-500 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                ♻️ Mode résurrection (même roster à chaque match, aucun PSP gagné) —
                seul mode disponible actuellement.
              </p>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Budget max par tier (kpo — laisser vide = budget par défaut du roster)
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(["I", "II", "III", "IV"] as const).map((tier) => (
                    <div key={`b-${tier}`}>
                      <label className="block text-[11px] text-gray-500 mb-0.5">
                        Tier {tier}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={tierBudgets[tier]}
                        onChange={(e) =>
                          setTierBudgets((prev) => ({ ...prev, [tier]: e.target.value }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        data-testid={`cup-tier-budget-${tier}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">
                  PSP de départ par tier (à dépenser au build — vide = 0)
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(["I", "II", "III", "IV"] as const).map((tier) => (
                    <div key={`p-${tier}`}>
                      <label className="block text-[11px] text-gray-500 mb-0.5">
                        Tier {tier}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={tierStartingPsp[tier]}
                        onChange={(e) =>
                          setTierStartingPsp((prev) => ({ ...prev, [tier]: e.target.value }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        data-testid={`cup-tier-psp-${tier}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Surcharge de budget par roster (prime sur le tier)
                </p>
                {rosterOverrides.map((o, i) => (
                  <div key={`o-${i}`} className="flex gap-2 mb-2">
                    <select
                      value={o.slug}
                      onChange={(e) =>
                        setRosterOverrides((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, slug: e.target.value } : x)),
                        )
                      }
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                      data-testid={`cup-budget-override-roster-${i}`}
                    >
                      <option value="">— Choisir un roster —</option>
                      {availableRosters.map((r) => (
                        <option key={r.slug} value={r.slug}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      placeholder="budget kpo"
                      value={o.budget}
                      onChange={(e) =>
                        setRosterOverrides((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, budget: e.target.value } : x)),
                        )
                      }
                      className="w-32 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setRosterOverrides((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="px-2 text-red-600 hover:text-red-800"
                      aria-label="Retirer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setRosterOverrides((prev) => [...prev, { slug: "", budget: "" }])
                  }
                  className="text-xs text-nuffle-gold hover:underline"
                >
                  + Ajouter un override budget roster
                </button>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Surcharge de PSP de départ par roster (prime sur le tier)
                </p>
                {rosterPspOverrides.map((o, i) => (
                  <div key={`op-${i}`} className="flex gap-2 mb-2">
                    <select
                      value={o.slug}
                      onChange={(e) =>
                        setRosterPspOverrides((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, slug: e.target.value } : x)),
                        )
                      }
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                      data-testid={`cup-psp-override-roster-${i}`}
                    >
                      <option value="">— Choisir un roster —</option>
                      {availableRosters.map((r) => (
                        <option key={r.slug} value={r.slug}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      placeholder="PSP"
                      value={o.psp}
                      onChange={(e) =>
                        setRosterPspOverrides((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, psp: e.target.value } : x)),
                        )
                      }
                      className="w-32 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setRosterPspOverrides((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="px-2 text-red-600 hover:text-red-800"
                      aria-label="Retirer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setRosterPspOverrides((prev) => [...prev, { slug: "", psp: "" }])
                  }
                  className="text-xs text-nuffle-gold hover:underline"
                >
                  + Ajouter un override PSP roster
                </button>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCupIsPublic}
                  onChange={(e) => setNewCupIsPublic(e.target.checked)}
                  className="rounded border-gray-300 text-nuffle-gold focus:ring-nuffle-gold"
                />
                <span className="text-sm text-gray-700">
                  Coupe publique (visible dans la liste)
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Si désactivé, la coupe sera privée et nécessitera un lien direct pour y accéder
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Création..." : "Créer la coupe"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCupName("");
                  setError(null);
                }}
                className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cups List */}
      <div className="grid gap-4">
        {cups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Aucune coupe disponible</p>
            <p className="text-sm text-gray-400 mt-2">
              Créez la première coupe pour commencer !
            </p>
          </div>
        ) : (
          cups.map((cup) => {
            return (
            <div
              key={cup.id}
              className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-nuffle-anthracite">
                      {cup.name}
                    </h2>
                    {cup.status === "ouverte" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Ouverte
                      </span>
                    )}
                    {cup.status === "en_cours" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        En cours
                      </span>
                    )}
                    {cup.status === "terminee" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Terminée
                      </span>
                    )}
                    {cup.status === "archivee" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Archivée
                      </span>
                    )}
                    {!cup.isPublic && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        🔒 Privée
                      </span>
                    )}
                    {cup.isCreator && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-nuffle-gold/20 text-nuffle-bronze">
                        Créateur
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      {rulesetLabels[cup.ruleset] || cup.ruleset}
                    </span>
                    <span
                      data-testid="cup-format-badge"
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (cup.format ?? "bb11") === "sevens"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {(cup.format ?? "bb11") === "sevens"
                        ? "Blood Bowl à Sept"
                        : "Blood Bowl à 11"}
                    </span>
                    <span
                      data-testid="cup-adjusted-badge"
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cup.isAdjusted
                          ? "bg-amber-50 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {cup.isAdjusted ? "⚙️ Règles ajustées" : "Règles standard"}
                    </span>
                  </div>
                  {cup.description && (
                    <p className="text-sm text-gray-700 mb-1 whitespace-pre-line">
                      {cup.description}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    Créée par <span className="font-medium">{cup.creator.coachName}</span>
                    {" • "}
                    {cup.participantCount} participant{cup.participantCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Créée le {new Date(cup.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Participants List */}
              {cup.participants.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Équipes inscrites ({cup.participants.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {cup.participants.map((participant) => (
                      <span
                        key={participant.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                        title={`${participant.name} (${getRosterName(participant.roster)}) - ${participant.owner.coachName}`}
                      >
                        {participant.name} ({participant.owner.coachName})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                {cup.isCreator && cup.status === "ouverte" && !cup.validated && (
                  <button
                    onClick={() => handleValidate(cup.id)}
                    className="px-4 py-2 bg-nuffle-gold text-white rounded-lg text-sm font-medium hover:bg-nuffle-gold/90 transition-all"
                  >
                    Fermer les inscriptions
                  </button>
                )}
                {cup.hasTeamParticipating && (
                  <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                    ✓ Une de vos équipes est inscrite
                  </div>
                )}
                {!cup.hasTeamParticipating && cup.status === "ouverte" && (
                  <p className="text-xs text-gray-500">
                    L'inscription se fait depuis la page de la coupe.
                  </p>
                )}
                <button
                  onClick={() => router.push(`/cups/${cup.id}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all"
                >
                  Voir les détails{!cup.hasTeamParticipating && cup.status === "ouverte" ? " & s'inscrire" : ""}
                </button>
              </div>
            </div>
          )})
        )}
      </div>
    </div>
  );
}

