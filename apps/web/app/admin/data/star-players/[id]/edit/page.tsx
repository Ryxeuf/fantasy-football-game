"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "../../../../../auth-client";
import { getRulesetLabel, type Ruleset } from "../../../ruleset-utils";
import {
  SkillMultiSelect,
  type SkillOption,
} from "../../../_components/SkillMultiSelect";
import {
  HirableByPicker,
  type RosterOption,
} from "../../_components/HirableByPicker";
import {
  hirableSelectionFromApi,
  hirableSelectionToPayload,
  toggleValue,
  type HirableByEntry,
  type HirableSelection,
} from "../../_components/star-player-options";

type StarPlayer = {
  id: string;
  slug: string;
  ruleset?: Ruleset;
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  keywords: string | null;
  specialRule: string | null;
  imageUrl: string | null;
  skills: Array<{ skill: { slug: string; nameFr: string } }>;
  hirableBy: HirableByEntry[];
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

async function putJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
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

export default function EditStarPlayerPage() {
  const router = useRouter();
  const params = useParams();
  const starPlayerId = params.id as string;

  const [starPlayer, setStarPlayer] = useState<StarPlayer | null>(null);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [rosters, setRosters] = useState<RosterOption[]>([]);
  const [skillSlugs, setSkillSlugs] = useState<string[]>([]);
  const [hirable, setHirable] = useState<HirableSelection>({
    rules: [],
    rosterIds: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [starPlayerId]);

  const loadData = async (): Promise<StarPlayer | null> => {
    setLoading(true);
    setError(null);
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
        return null;
      }
      const { starPlayer: spData } = await fetchJSON(
        `/admin/data/star-players/${starPlayerId}`,
      );
      setStarPlayer(spData);
      setSkillSlugs(
        (spData?.skills ?? [])
          .map((s: { skill?: { slug?: string } }) => s?.skill?.slug)
          .filter((slug: string | undefined): slug is string => !!slug),
      );
      setHirable(hirableSelectionFromApi(spData?.hirableBy));

      // Catalogues filtrés sur le ruleset du Star Player : un même slug de
      // compétence existe sur plusieurs rulesets, sans ce filtre la liste
      // est dédoublée (et le slug envoyé serait ambigu côté serveur).
      const ruleset: string | undefined = spData?.ruleset;
      const rulesetQuery = ruleset
        ? `?ruleset=${encodeURIComponent(ruleset)}`
        : "";
      const [skillsRes, rostersRes] = await Promise.all([
        fetchJSON(`/admin/data/skills${rulesetQuery}`).catch(() => ({
          skills: [],
        })),
        fetchJSON(`/admin/data/rosters${rulesetQuery}`).catch(() => ({
          rosters: [],
        })),
      ]);
      setSkills(Array.isArray(skillsRes?.skills) ? skillsRes.skills : []);
      setRosters(Array.isArray(rostersRes?.rosters) ? rostersRes.rosters : []);
      return spData ?? null;
    } catch (e: any) {
      setError(e.message || "Erreur");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!starPlayer) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    try {
      const data = {
        displayName: formData.get("displayName"),
        cost: parseInt(formData.get("cost") as string),
        ma: parseInt(formData.get("ma") as string),
        st: parseInt(formData.get("st") as string),
        ag: parseInt(formData.get("ag") as string),
        pa: formData.get("pa") ? parseInt(formData.get("pa") as string) : null,
        av: parseInt(formData.get("av") as string),
        keywords: formData.get("keywords") || null,
        specialRule: formData.get("specialRule") || null,
        imageUrl: formData.get("imageUrl") || null,
        skillSlugs,
        hirableBy: hirableSelectionToPayload(hirable, rosters),
      };
      await putJSON(`/admin/data/star-players/${starPlayer.id}`, data);
      // Relecture serveur plutôt qu'une redirection à l'aveugle : l'admin
      // voit ce qui est RÉELLEMENT enregistré (cf. édition des rosters).
      const saved = await loadData();
      setSuccess(
        saved
          ? `Star Player enregistré. Compétences : ${saved.skills?.length ?? 0} · Recrutable par : ${saved.hirableBy?.length ?? 0} règle(s).`
          : "Star Player enregistré.",
      );
    } catch (e: any) {
      setError(e.message || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (!starPlayer) return <div>Star Player non trouvé</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Modifier un Star Player</h1>
        <button
          onClick={() => router.push("/admin/data/star-players")}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Annuler
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 border border-red-200 rounded">{error}</p>}

      {success && (
        <p
          data-testid="star-player-save-success"
          className="text-green-700 text-sm mb-4 p-3 bg-green-50 border border-green-200 rounded"
        >
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 border rounded shadow-sm">
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="text-sm text-gray-600">
            <strong>Slug:</strong> {starPlayer.slug}
            {starPlayer.ruleset ? (
              <>
                {" · "}
                <strong>Ruleset:</strong> {getRulesetLabel(starPlayer.ruleset)}
              </>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Nom d'affichage *</label>
            <input
              type="text"
              name="displayName"
              defaultValue={starPlayer.displayName}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Coût (po) *</label>
            <input
              type="number"
              name="cost"
              defaultValue={starPlayer.cost}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div></div>
          <div>
            <label className="block text-sm font-medium mb-1">MA *</label>
            <input
              type="number"
              name="ma"
              defaultValue={starPlayer.ma}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ST *</label>
            <input
              type="number"
              name="st"
              defaultValue={starPlayer.st}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">AG *</label>
            <input
              type="number"
              name="ag"
              defaultValue={starPlayer.ag}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">PA</label>
            <input
              type="number"
              name="pa"
              defaultValue={starPlayer.pa || ""}
              className="w-full border rounded px-3 py-2"
              placeholder="Laissez vide pour -"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">AV *</label>
            <input
              type="number"
              name="av"
              defaultValue={starPlayer.av}
              required
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">URL Image</label>
            <input
              type="text"
              name="imageUrl"
              defaultValue={starPlayer.imageUrl || ""}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium mb-1">
              Mots-clés (lignée + type, séparés par des virgules)
            </label>
            <input
              type="text"
              name="keywords"
              defaultValue={starPlayer.keywords || ""}
              className="w-full border rounded px-3 py-2"
              placeholder="ex: Humain, Blitzer"
            />
            <p className="mt-1 text-xs text-gray-500">
              Même vocabulaire que les mots-clés de position (ex: « Ogre, Gros Bras »).
            </p>
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium mb-1">Règle spéciale</label>
            <textarea
              name="specialRule"
              defaultValue={starPlayer.specialRule || ""}
              rows={2}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Compétences</label>
          <SkillMultiSelect
            skills={skills}
            selectedSlugs={skillSlugs}
            onChange={setSkillSlugs}
            testId="star-player-skills"
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
            {saving ? "Mise à jour..." : "Mettre à jour"}
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
