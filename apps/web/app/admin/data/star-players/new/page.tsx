"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../../auth-client";
import {
  DEFAULT_RULESET,
  RULESET_OPTIONS,
  type Ruleset,
} from "../../ruleset-utils";
import {
  SkillCheckboxPicker,
  type SkillOption,
} from "../_components/SkillCheckboxPicker";
import {
  HirableByPicker,
  type RosterOption,
} from "../_components/HirableByPicker";
import {
  hirableSelectionToPayload,
  toggleValue,
  type HirableSelection,
} from "../_components/star-player-options";

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

export default function NewStarPlayerPage() {
  const router = useRouter();
  const [ruleset, setRuleset] = useState<Ruleset>(DEFAULT_RULESET);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [rosters, setRosters] = useState<RosterOption[]>([]);
  const [skillSlugs, setSkillSlugs] = useState<string[]>([]);
  const [hirable, setHirable] = useState<HirableSelection>({
    rules: [],
    rosterIds: [],
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Catalogues filtrés sur le ruleset choisi : un même slug de compétence
  // existe sur plusieurs rulesets, sans ce filtre la liste est dédoublée
  // (et le slug envoyé serait ambigu côté serveur).
  const loadCatalogs = useCallback(async (target: Ruleset) => {
    const query = `?ruleset=${encodeURIComponent(target)}`;
    const [skillsRes, rostersRes] = await Promise.all([
      fetchJSON(`/admin/data/skills${query}`).catch(() => ({ skills: [] })),
      fetchJSON(`/admin/data/rosters${query}`).catch(() => ({ rosters: [] })),
    ]);
    setSkills(Array.isArray(skillsRes?.skills) ? skillsRes.skills : []);
    setRosters(Array.isArray(rostersRes?.rosters) ? rostersRes.rosters : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchJSON("/auth/me");
        const user = me?.user;
        const roles: string[] | undefined = Array.isArray(user?.roles)
          ? user.roles
          : user?.role
            ? [user.role]
            : undefined;
        if (!roles || !roles.includes("admin")) {
          router.push("/");
          return;
        }
        if (!cancelled) setAuthChecked(true);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Erreur");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Le formulaire reste monte pendant le rechargement des catalogues :
  // changer de ruleset ne doit pas vider les champs deja saisis.
  useEffect(() => {
    if (!authChecked) return;
    let cancelled = false;
    (async () => {
      setCatalogsLoading(true);
      try {
        await loadCatalogs(ruleset);
      } finally {
        if (!cancelled) setCatalogsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authChecked, ruleset, loadCatalogs]);

  const handleRulesetChange = (next: Ruleset) => {
    // Les catalogues changent : on repart d'une sélection vide plutôt que
    // de garder des slugs qui n'existent pas dans le nouveau ruleset.
    setRuleset(next);
    setSkillSlugs([]);
    setHirable({ rules: [], rosterIds: [] });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const data = {
        slug: formData.get("slug"),
        ruleset,
        displayName: formData.get("displayName"),
        cost: parseInt(formData.get("cost") as string),
        ma: parseInt(formData.get("ma") as string),
        st: parseInt(formData.get("st") as string),
        ag: parseInt(formData.get("ag") as string),
        pa: formData.get("pa") ? parseInt(formData.get("pa") as string) : null,
        av: parseInt(formData.get("av") as string),
        specialRule: formData.get("specialRule") || null,
        imageUrl: formData.get("imageUrl") || null,
        skillSlugs,
        hirableBy: hirableSelectionToPayload(hirable, rosters),
      };
      await postJSON("/admin/data/star-players", data);
      router.push("/admin/data/star-players");
    } catch (e: any) {
      setError(e.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  // Un echec du controle d'acces doit rester visible : sans ca la page
  // resterait bloquee sur « Chargement... » sans expliquer pourquoi.
  if (!authChecked) {
    return error ? (
      <p className="text-red-600 text-sm p-3 bg-red-50 border border-red-200 rounded">
        {error}
      </p>
    ) : (
      <div>Chargement...</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Créer un Star Player</h1>
        <button
          onClick={() => router.push("/admin/data/star-players")}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Annuler
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 border border-red-200 rounded">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white p-6 border rounded shadow-sm">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Ruleset *</label>
            <select
              name="ruleset"
              value={ruleset}
              onChange={(e) => handleRulesetChange(e.target.value as Ruleset)}
              disabled={catalogsLoading}
              className="w-full border rounded px-3 py-2"
            >
              {RULESET_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug *</label>
            <input
              type="text"
              name="slug"
              required
              className="w-full border rounded px-3 py-2"
              placeholder="ex: griff_oberwald"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom d'affichage *</label>
            <input
              type="text"
              name="displayName"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Coût (po) *</label>
            <input
              type="number"
              name="cost"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">MA *</label>
            <input
              type="number"
              name="ma"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ST *</label>
            <input
              type="number"
              name="st"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">AG *</label>
            <input
              type="number"
              name="ag"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">PA</label>
            <input
              type="number"
              name="pa"
              className="w-full border rounded px-3 py-2"
              placeholder="Laissez vide pour -"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">AV *</label>
            <input
              type="number"
              name="av"
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">URL Image</label>
            <input
              type="text"
              name="imageUrl"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium mb-1">Règle spéciale</label>
            <textarea
              name="specialRule"
              rows={2}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">
            Compétences{catalogsLoading ? " (chargement…)" : ""}
          </label>
          <SkillCheckboxPicker
            skills={skills}
            selected={skillSlugs}
            onToggle={(slug) => setSkillSlugs((prev) => toggleValue(prev, slug))}
          />
          <p className="text-xs text-gray-500 mt-1">
            Sélection multiple. Aucune case cochée = aucune compétence.
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Recrutable par</label>
          <HirableByPicker
            rosters={rosters}
            selection={hirable}
            onToggleRule={(slug) =>
              setHirable((prev) => ({
                ...prev,
                rules: toggleValue(prev.rules, slug),
              }))
            }
            onToggleRoster={(rosterId) =>
              setHirable((prev) => ({
                ...prev,
                rosterIds: toggleValue(prev.rosterIds, rosterId),
              }))
            }
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Création..." : "Créer le Star Player"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/data/star-players")}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
