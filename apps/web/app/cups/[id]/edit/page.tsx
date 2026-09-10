"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api-client";
import {
  CUP_TIE_BREAK_LABELS,
  CUP_TIE_BREAK_ORDER,
} from "../tie-break-labels";
import { moveRule, toggleRule } from "./tie-break-editor";

/**
 * Édition d'une coupe par son commissaire — pendant de `/leagues/[id]/edit`.
 *
 * Une coupe n'avait aucun chemin d'édition : corriger un nom, un barème ou
 * poser un critère de départage imposait de la recréer, donc de réinscrire
 * tout le monde. Le barème et les départages restent modifiables en cours de
 * coupe : le classement est entièrement dérivé des matchs, il se recalcule
 * au prochain affichage.
 *
 * L'édition, le format et le règlement de tournoi ne sont PAS éditables : les
 * équipes ont été construites POUR eux (le serveur les refuse aussi).
 */

interface CupForEdit {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  status: string;
  isCreator?: boolean;
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
  tieBreakRules?: string[];
}

const SCORING_FIELDS = [
  { key: "winPoints", label: "Victoire" },
  { key: "drawPoints", label: "Match nul" },
  { key: "lossPoints", label: "Défaite" },
  { key: "forfeitPoints", label: "Forfait" },
  { key: "touchdownPoints", label: "Touchdown marqué" },
  { key: "blockCasualtyPoints", label: "Sortie sur blocage / blitz" },
  { key: "foulCasualtyPoints", label: "Sortie sur agression" },
  { key: "passPoints", label: "Passe réussie" },
] as const;

type ScoringKey = (typeof SCORING_FIELDS)[number]["key"];

export default function CupEditPage() {
  const params = useParams<{ id: string }>();
  const cupId = params?.id ?? "";
  const router = useRouter();

  const [cup, setCup] = useState<CupForEdit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [scoring, setScoring] = useState<Record<ScoringKey, string>>({
    winPoints: "",
    drawPoints: "",
    lossPoints: "",
    forfeitPoints: "",
    touchdownPoints: "",
    blockCasualtyPoints: "",
    foulCasualtyPoints: "",
    passPoints: "",
  });
  const [tieBreak, setTieBreak] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ cup: CupForEdit }>(`/cup/${cupId}`);
      setCup(res.cup);
      setName(res.cup.name);
      setDescription(res.cup.description ?? "");
      setIsPublic(res.cup.isPublic);
      setTieBreak(res.cup.tieBreakRules ?? []);
      const sc = res.cup.scoringConfig;
      if (sc) {
        setScoring({
          winPoints: String(sc.winPoints),
          drawPoints: String(sc.drawPoints),
          lossPoints: String(sc.lossPoints),
          forfeitPoints: String(sc.forfeitPoints),
          touchdownPoints: String(sc.touchdownPoints),
          blockCasualtyPoints: String(sc.blockCasualtyPoints),
          foulCasualtyPoints: String(sc.foulCasualtyPoints),
          passPoints: String(sc.passPoints),
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [cupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        isPublic,
        // `null` remet la coupe sur l'ordre par défaut : c'est ce que
        // signifie « aucun critère coché ».
        tieBreakRules: tieBreak.length > 0 ? tieBreak : null,
      };
      for (const field of SCORING_FIELDS) {
        const raw = scoring[field.key];
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) body[field.key] = parsed;
      }
      await apiRequest(`/cup/${cupId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      router.push(`/cups/${cupId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-sm text-gray-500">
        Chargement…
      </main>
    );
  }
  if (!cup) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p data-testid="cup-edit-error" className="text-sm text-red-700">
          {error ?? "Coupe introuvable"}
        </p>
      </main>
    );
  }
  if (!cup.isCreator) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-6">
        <p data-testid="cup-edit-forbidden" className="text-sm text-gray-700">
          Seul le commissaire de la coupe peut la modifier.
        </p>
        <Link href={`/cups/${cupId}`} className="text-sm text-nuffle-bronze hover:underline">
          ← Retour à la coupe
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4" data-testid="cup-edit">
      <Link
        href={`/cups/${cupId}`}
        className="inline-block text-sm text-nuffle-bronze hover:underline"
      >
        ← Retour à la coupe
      </Link>
      <h1 className="text-xl font-semibold text-gray-900">
        Modifier « {cup.name} »
      </h1>

      {error && (
        <div
          data-testid="cup-edit-error"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <section className="space-y-3 rounded-lg border bg-white p-4">
          <label className="block text-sm font-medium text-gray-700">
            Nom
            <input
              data-testid="cup-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Description
            <textarea
              data-testid="cup-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              data-testid="cup-edit-public"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Coupe publique (visible dans la liste)
          </label>
        </section>

        <section className="space-y-3 rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Système de points
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SCORING_FIELDS.map((field) => (
              <label
                key={field.key}
                className="flex items-center justify-between gap-2 text-sm text-gray-700"
              >
                {field.label}
                <input
                  type="number"
                  data-testid={`cup-edit-${field.key}`}
                  value={scoring[field.key]}
                  onChange={(e) =>
                    setScoring((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm tabular-nums"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Critères de classement
          </h2>
          <p className="text-xs text-gray-500">
            Cochez les départages et ordonnez-les : ils sont appliqués du
            premier au dernier. Sans sélection, l&apos;ordre par défaut
            s&apos;applique (points, différence de TD, TD marqués, victoires,
            nom).
          </p>
          <ul className="space-y-1" data-testid="cup-tiebreak-editor">
            {tieBreak.map((slug, index) => (
              <li
                key={slug}
                className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm"
              >
                <span className="w-5 tabular-nums text-gray-400">
                  {index + 1}.
                </span>
                <span className="flex-1">
                  {CUP_TIE_BREAK_LABELS[slug] ?? slug}
                </span>
                <button
                  type="button"
                  aria-label="Monter"
                  data-testid={`cup-tiebreak-up-${slug}`}
                  disabled={index === 0}
                  onClick={() => setTieBreak(moveRule(tieBreak, slug, -1))}
                  className="px-1 text-gray-500 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Descendre"
                  data-testid={`cup-tiebreak-down-${slug}`}
                  disabled={index === tieBreak.length - 1}
                  onClick={() => setTieBreak(moveRule(tieBreak, slug, 1))}
                  className="px-1 text-gray-500 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  data-testid={`cup-tiebreak-remove-${slug}`}
                  onClick={() => setTieBreak(toggleRule(tieBreak, slug))}
                  className="px-1 text-xs text-red-600 hover:underline"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {CUP_TIE_BREAK_ORDER.filter((slug) => !tieBreak.includes(slug)).map(
              (slug) => (
                <button
                  key={slug}
                  type="button"
                  data-testid={`cup-tiebreak-add-${slug}`}
                  onClick={() => setTieBreak(toggleRule(tieBreak, slug))}
                  className="rounded-full border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  + {CUP_TIE_BREAK_LABELS[slug] ?? slug}
                </button>
              ),
            )}
          </div>
        </section>

        <button
          type="submit"
          data-testid="cup-edit-submit"
          disabled={saving}
          className="rounded-lg bg-nuffle-gold px-4 py-2 text-sm font-medium text-white hover:bg-nuffle-gold/90 disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </main>
  );
}
