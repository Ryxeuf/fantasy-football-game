/**
 * Formatage pur du journal d'équipe (page `/me/teams/[id]/journal`).
 *
 * Toute la logique d'affichage vit ici — la page se contente de rendre —
 * pour que le regroupement par opération et la lecture des diffs soient
 * testables sans monter React ni le DOM.
 */

/** Snapshot d'équipe tel que servi par l'API (sous-ensemble utilisé). */
export interface JournalSnapshot {
  readonly treasury: number;
  readonly teamValue: number;
  readonly currentValue: number;
  readonly activePlayerCount: number;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
}

export interface JournalEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly correlationId: string;
  readonly step: number;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string | null;
  readonly actorUserId: string | null;
  readonly actorRole: string;
  readonly actorLabel: string | null;
  readonly impersonatorId: string | null;
  readonly source: string;
  readonly route: string | null;
  readonly ipAddress: string | null;
  readonly changes: Record<string, { from: unknown; to: unknown }> | null;
  readonly before: JournalSnapshot | null;
  readonly after: JournalSnapshot | null;
  readonly details: unknown;
  readonly treasury: number | null;
  readonly teamValue: number | null;
  readonly currentValue: number | null;
  readonly treasuryDelta: number | null;
  readonly teamValueDelta: number | null;
  readonly note: string | null;
  readonly summary: string;
}

/**
 * Une opération = toutes les étapes d'une même requête. C'est l'unité que
 * le coach reconnaît (« mon achat »), là où le journal brut ne montre que
 * des écritures successives.
 */
export interface JournalOperation {
  readonly correlationId: string;
  /** Horodatage de la PREMIÈRE étape de l'opération. */
  readonly startedAt: string;
  /** Étapes triées par `step` croissant (l'ordre réel d'exécution). */
  readonly steps: readonly JournalEntry[];
  /** Somme des variations de trésorerie sur l'opération entière. */
  readonly treasuryDelta: number;
  /** Somme des variations de VE sur l'opération entière. */
  readonly teamValueDelta: number;
  /** Trésorerie à la fin de l'opération (dernière étape qui la porte). */
  readonly treasuryAfter: number | null;
  /** VE à la fin de l'opération. */
  readonly teamValueAfter: number | null;
  /** Résumé de l'étape « tête d'affiche » (la 1re, celle qui nomme l'acte). */
  readonly headline: string;
  readonly actorLabel: string | null;
  readonly actorRole: string;
  /** Au moins une étape a échoué. */
  readonly failed: boolean;
}

/**
 * Regroupe les étapes par corrélation, opérations les plus récentes en
 * tête, étapes dans l'ordre d'exécution à l'intérieur.
 *
 * L'API sert déjà les entrées les plus récentes d'abord ; on ne dépend pas
 * de cet ordre (une page peut couper une opération en deux) et on retrie.
 */
export function groupByOperation(
  entries: readonly JournalEntry[],
): JournalOperation[] {
  const byCorrelation = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const bucket = byCorrelation.get(entry.correlationId);
    if (bucket) bucket.push(entry);
    else byCorrelation.set(entry.correlationId, [entry]);
  }

  const operations: JournalOperation[] = [];
  for (const [correlationId, rawSteps] of byCorrelation) {
    const steps = [...rawSteps].sort((a, b) => a.step - b.step);
    const first = steps[0];
    const treasuryAfter = lastDefined(steps, (s) => s.treasury);
    const teamValueAfter = lastDefined(steps, (s) => s.teamValue);
    operations.push({
      correlationId,
      startedAt: first.createdAt,
      steps,
      treasuryDelta: steps.reduce((sum, s) => sum + (s.treasuryDelta ?? 0), 0),
      teamValueDelta: steps.reduce((sum, s) => sum + (s.teamValueDelta ?? 0), 0),
      treasuryAfter,
      teamValueAfter,
      headline: first.summary,
      actorLabel: first.actorLabel,
      actorRole: first.actorRole,
      failed: steps.some((s) => s.action.endsWith(".failed")),
    });
  }

  return operations.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Dernière valeur non nulle d'une suite d'étapes (l'état final). */
function lastDefined(
  steps: readonly JournalEntry[],
  pick: (s: JournalEntry) => number | null,
): number | null {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const value = pick(steps[i]);
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

/** Montant en or, format court (« 320k po »). Les valeurs sont en po. */
export function formatGold(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `${Math.round(amount / 1000).toLocaleString("fr-FR")}k po`;
}

/** Variation signée en or (« +80k po » / « -80k po » / « — » si nulle). */
export function formatGoldDelta(delta: number | null | undefined): string {
  if (!delta) return "—";
  const sign = delta > 0 ? "+" : "-";
  return `${sign}${Math.round(Math.abs(delta) / 1000).toLocaleString("fr-FR")}k po`;
}

/** Classe Tailwind d'une variation : vert si l'or entre, rouge s'il sort. */
export function deltaToneClass(delta: number | null | undefined): string {
  if (!delta) return "text-gray-500";
  return delta > 0 ? "text-green-700" : "text-red-700";
}

/** Horodatage lisible en français, à la seconde (le pas du journal). */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Libellés français des champs d'état d'équipe suivis par le diff. */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: "Nom",
  roster: "Roster",
  ruleset: "Édition",
  format: "Format",
  treasury: "Trésorerie",
  teamValue: "VE",
  currentValue: "VEA",
  initialBudget: "Budget initial",
  rerolls: "Relances",
  cheerleaders: "Pom-pom girls",
  assistants: "Assistants",
  apothecary: "Apothicaire",
  dedicatedFans: "Fans dévoués",
  startingPspPool: "Pool de PSP",
  deleted: "Supprimée",
  activePlayerCount: "Joueurs actifs",
  totalPlayerCount: "Joueurs (total)",
  starPlayerCount: "Star Players",
  starPlayersCost: "Coût des Star Players",
};

/** Champs libellés en or (formatés en kpo plutôt qu'en nombre brut). */
const GOLD_FIELDS = new Set([
  "treasury",
  "teamValue",
  "currentValue",
  "starPlayersCost",
]);

export interface FormattedChange {
  readonly field: string;
  readonly label: string;
  readonly from: string;
  readonly to: string;
}

/** Met un diff brut en forme pour l'affichage (libellés + unités). */
export function formatChanges(
  changes: Record<string, { from: unknown; to: unknown }> | null,
): FormattedChange[] {
  if (!changes) return [];
  return Object.entries(changes).map(([field, { from, to }]) => ({
    field,
    label: FIELD_LABELS[field] ?? field,
    from: formatFieldValue(field, from),
    to: formatFieldValue(field, to),
  }));
}

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "oui" : "non";
  if (typeof value === "number" && GOLD_FIELDS.has(field)) {
    return formatGold(value);
  }
  if (typeof value === "number") return value.toLocaleString("fr-FR");
  return String(value);
}

/** Options du filtre d'action, alignées sur les préfixes de slugs serveur. */
export const ACTION_FILTERS: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
}> = [
  { value: "", label: "Toutes les actions" },
  { value: "team.purchase", label: "Achats (trésorerie)" },
  { value: "team.player", label: "Joueurs" },
  { value: "team.values", label: "Recalculs de VE" },
  { value: "team.treasury", label: "Mouvements de trésorerie" },
  { value: "team.roster", label: "Sauvegardes de roster" },
  { value: "team.star-player", label: "Star Players" },
  { value: "league", label: "Ligue (après-match)" },
  { value: "commissioner", label: "Commissaire" },
];
