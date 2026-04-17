"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  adminCreateFlag,
  adminDeleteFlag,
  adminListFlags,
  adminUpdateFlag,
  type FeatureFlag,
} from "../../lib/featureFlags";

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [newKey, setNewKey] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newEnabled, setNewEnabled] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminListFlags();
      setFlags(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleEnabled = async (flag: FeatureFlag) => {
    try {
      const updated = await adminUpdateFlag(flag.id, {
        enabled: !flag.enabled,
      });
      setFlags((prev) =>
        prev.map((f) => (f.id === flag.id ? { ...f, ...updated } : f)),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const removeFlag = async (flag: FeatureFlag) => {
    if (!window.confirm(`Supprimer le flag "${flag.key}" ?`)) return;
    try {
      await adminDeleteFlag(flag.id);
      setFlags((prev) => prev.filter((f) => f.id !== flag.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await adminCreateFlag({
        key: newKey.trim(),
        description: newDescription.trim() || null,
        enabled: newEnabled,
      });
      setNewKey("");
      setNewDescription("");
      setNewEnabled(false);
      setCreateOpen(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur création");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-nuffle-anthracite flex items-center gap-2">
            <span>🚩</span> Feature Flags
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Activez des fonctionnalités globalement ou pour des utilisateurs
            spécifiques.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen((prev) => !prev)}
          className="px-4 py-2 rounded-lg bg-nuffle-gold text-white hover:bg-nuffle-bronze transition"
        >
          {createOpen ? "Annuler" : "+ Nouveau flag"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {createOpen && (
        <form
          onSubmit={submitCreate}
          className="mb-6 p-4 rounded-lg bg-white border border-gray-200 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Clé *</label>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="ex: new_match_ui"
              required
              pattern="^[a-z0-9][a-z0-9_-]{0,63}$"
              title="Minuscules, chiffres, '_' ou '-' (1-64 caractères)"
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="À quoi sert ce flag ?"
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newEnabled}
              onChange={(e) => setNewEnabled(e.target.checked)}
            />
            Activer globalement dès la création
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded bg-nuffle-gold text-white hover:bg-nuffle-bronze disabled:opacity-50"
            >
              {submitting ? "Création..." : "Créer"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-gray-500">Chargement...</div>
      ) : flags.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
          Aucun feature flag. Créez-en un pour commencer.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Clé</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Global</th>
                <th className="px-4 py-3">Utilisateurs</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flags.map((flag) => (
                <tr key={flag.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{flag.key}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {flag.description || (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleEnabled(flag)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                        flag.enabled
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {flag.enabled ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={
                        `/admin/feature-flags/${flag.id}` as never as string
                      }
                      className="text-nuffle-bronze hover:underline"
                    >
                      {flag.userOverrideCount} override
                      {flag.userOverrideCount !== 1 ? "s" : ""}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeFlag(flag)}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
