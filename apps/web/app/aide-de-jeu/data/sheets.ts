/**
 * Fiches de l'aide de jeu — contenu DÉRIVÉ, jamais recopié.
 *
 * Deux sources, toutes deux déjà versionnées et déjà reformulées :
 *  - le compendium publié (`app/compendium/data/rules-bb-2025.json`) pour
 *    les tables de règles ;
 *  - `@bb/game-engine` pour la météo et les prières à Nuffle, absentes du
 *    compendium.
 *
 * Une table est référencée par son `caption` exact. Si le compendium la
 * renomme, `tableFromChapter` lève et `sheets.test.ts` échoue : le
 * renommage est traité dans le même commit, au lieu de publier une fiche
 * vide en silence (cf. openspec/changes/add-game-help-companion/design.md).
 */

import { PRAYERS_TABLE, WEATHER_TYPES } from "@bb/game-engine";
import { getChapter } from "../../compendium/data";
import type { CompendiumBlock } from "../../compendium/types";

/** Table extraite du compendium, prête à rendre. */
export interface SheetTable {
  readonly caption?: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** Un onglet de fiche (la météo en a 12, un par type de terrain). */
export interface SheetVariant {
  readonly id: string;
  readonly label: string;
  readonly table: SheetTable;
}

export interface Sheet {
  readonly id: string;
  readonly title: string;
  /** Libellé du dé, ex. « 2D6 », « D16 ». Affiché en pastille. */
  readonly dice: string;
  /** Une phrase : quand consulter cette fiche. */
  readonly hint: string;
  /** Onglets ; une seule entrée pour les fiches simples. */
  readonly variants: readonly SheetVariant[];
  /** Slug du chapitre du compendium à lire en entier, si applicable. */
  readonly chapterSlug?: string;
}

/** Levée quand une table référencée a disparu du compendium. */
export class SheetSourceError extends Error {
  constructor(
    readonly chapterSlug: string,
    readonly caption: string,
  ) {
    super(
      `Table « ${caption} » introuvable dans le chapitre « ${chapterSlug} » du compendium.`,
    );
    this.name = "SheetSourceError";
  }
}

function isTable(
  block: CompendiumBlock,
): block is Extract<CompendiumBlock, { type: "table" }> {
  return block.type === "table";
}

/** Extrait une table du compendium par (chapitre, caption). Lève si absente. */
export function tableFromChapter(
  chapterSlug: string,
  caption: string,
): SheetTable {
  const chapter = getChapter(chapterSlug);
  const block = chapter?.blocks.filter(isTable).find((b) => b.caption === caption);
  if (!block) throw new SheetSourceError(chapterSlug, caption);
  return { caption: block.caption, columns: block.columns, rows: block.rows };
}

/** Fiche à un seul onglet, adossée à une table du compendium. */
function compendiumSheet(
  id: string,
  title: string,
  dice: string,
  hint: string,
  chapterSlug: string,
  caption: string,
): Sheet {
  return {
    id,
    title,
    dice,
    hint,
    chapterSlug,
    variants: [{ id, label: title, table: tableFromChapter(chapterSlug, caption) }],
  };
}

/** Fiche multi-onglets adossée à plusieurs tables du même chapitre. */
function compendiumSheetMulti(
  id: string,
  title: string,
  dice: string,
  hint: string,
  chapterSlug: string,
  parts: ReadonlyArray<{ id: string; label: string; caption: string }>,
): Sheet {
  return {
    id,
    title,
    dice,
    hint,
    chapterSlug,
    variants: parts.map((p) => ({
      id: p.id,
      label: p.label,
      table: tableFromChapter(chapterSlug, p.caption),
    })),
  };
}

/**
 * Météo — absente du compendium, tirée des 12 types de terrain de
 * l'engine. Les scores identiques consécutifs sont fusionnés en plage
 * (« 4-10 ») : la table brute répète sept fois « Conditions parfaites ».
 */
function weatherSheet(): Sheet {
  return {
    id: "meteo",
    title: "Météo",
    dice: "2D6",
    hint: "Avant le match, et à nouveau sur un événement « Météo capricieuse ».",
    variants: WEATHER_TYPES.map((type) => ({
      id: type.id,
      label: type.name,
      table: {
        caption: `Météo — ${type.name}`,
        columns: ["2D6", "Condition", "Effet"],
        rows: mergeWeatherRows(type.table),
      },
    })),
  };
}

/** Fusionne les scores consécutifs partageant la même condition. */
export function mergeWeatherRows(table: {
  [key: number]: { condition: string; description: string };
}): string[][] {
  const rows: string[][] = [];
  let start: number | null = null;
  let lastSeen: number | null = null;
  let previous: { condition: string; description: string } | null = null;

  const flush = (): void => {
    if (start === null || lastSeen === null || !previous) return;
    rows.push([
      start === lastSeen ? String(start) : `${start}-${lastSeen}`,
      previous.condition,
      previous.description,
    ]);
  };

  for (let score = 2; score <= 12; score += 1) {
    const entry = table[score];
    if (!entry) continue;
    if (previous && entry.condition === previous.condition) {
      // Même condition : on étend la plage en cours plutôt que de la rouvrir.
      lastSeen = score;
      continue;
    }
    flush();
    start = score;
    previous = entry;
    lastSeen = score;
  }
  flush();
  return rows;
}

/** Prières à Nuffle — table D16 de l'engine, descriptions FR reformulées. */
function prayersSheet(): Sheet {
  const rows = Object.keys(PRAYERS_TABLE)
    .map(Number)
    .sort((a, b) => a - b)
    .map((n) => [String(n), PRAYERS_TABLE[n].nameFr, PRAYERS_TABLE[n].descriptionFr]);

  return {
    id: "prieres-nuffle",
    title: "Prières à Nuffle",
    dice: "D16",
    hint: "Pour l'outsider, une prière par tranche de 50 000 PO d'écart de VEA.",
    variants: [
      {
        id: "prieres-nuffle",
        label: "Prières à Nuffle",
        table: { caption: "Prières à Nuffle (D16)", columns: ["D16", "Prière", "Effet"], rows },
      },
    ],
  };
}

/** Catalogue complet des fiches, construit une fois au chargement du module. */
export const SHEETS: readonly Sheet[] = [
  weatherSheet(),
  prayersSheet(),
  compendiumSheetMulti(
    "coup-d-envoi",
    "Événements de coup d'envoi",
    "2D6",
    "Après la déviation du ballon, le coach qui engage lance les dés.",
    "coup-d-envoi",
    [
      { id: "2d6", label: "Standard (2D6)", caption: "Événements de coup d'envoi (2D6)" },
      { id: "d16", label: "Variante (D16)", caption: "Événements de coup d'envoi (D16)" },
    ],
  ),
  compendiumSheet(
    "coups-de-pouce",
    "Coups de pouce",
    "PO",
    "Avant le match : la VEA la plus haute dépense en premier.",
    "coups-de-pouce",
    "Liste des coups de pouce communs et de leur coût",
  ),
  compendiumSheetMulti(
    "blessure",
    "Jet de blessure",
    "2D6",
    "Quand le jet d'armure dépasse la valeur AR de la cible.",
    "blessures-eliminations",
    [
      { id: "standard", label: "Standard", caption: "Tableau de blessure (standard)" },
      { id: "minus", label: "Trait Minus", caption: "Tableau de blessure de Minus" },
    ],
  ),
  compendiumSheetMulti(
    "elimination",
    "Élimination & séquelles",
    "D16",
    "Sur un résultat Blessé au jet de blessure.",
    "blessures-eliminations",
    [
      { id: "elimination", label: "Élimination", caption: "Tableau d'élimination" },
      { id: "sequelle", label: "Séquelles", caption: "Tableau de séquelle" },
    ],
  ),
  compendiumSheet(
    "contester",
    "Contester la décision",
    "D6",
    "Quand l'un de vos joueurs est expulsé, quel qu'en soit le motif.",
    "agressions",
    "Contester la décision (D6)",
  ),
  compendiumSheet(
    "psp-actions",
    "PSP par action",
    "PSP",
    "Après le match, pour créditer chaque joueur.",
    "amelioration-joueurs",
    "PSP rapportés par action",
  ),
  compendiumSheet(
    "cout-ameliorations",
    "Coût des améliorations",
    "PSP",
    "Le coût dépend du palier atteint et du type d'amélioration.",
    "amelioration-joueurs",
    "Coût en PSP par palier et type d'amélioration",
  ),
  compendiumSheet(
    "amelioration-carac",
    "Amélioration de caractéristique",
    "D8",
    "Quand un joueur dépense ses PSP pour une caractéristique.",
    "amelioration-joueurs",
    "Tableau d'amélioration de caractéristique (D8)",
  ),
  compendiumSheet(
    "hausse-valeur",
    "Hausse de valeur",
    "PO",
    "Chaque amélioration augmente la valeur du joueur, donc la VE.",
    "amelioration-joueurs",
    "Hausse de valeur par type d'amélioration",
  ),
  compendiumSheet(
    "competences",
    "Tableau de compétences",
    "2D6",
    "Pour une compétence aléatoire : deux D6, ligne puis colonne.",
    "tableau-competences",
    "Compétences par catégorie selon le résultat de deux D6",
  ),
  compendiumSheet(
    "fans-devoues",
    "Fans dévoués",
    "D6",
    "Après chaque rencontre de ligue, selon le résultat du match.",
    "jeu-en-ligue",
    "Évolution des Fans Dévoués",
  ),
  compendiumSheetMulti(
    "erreurs-couteuses",
    "Erreurs coûteuses",
    "D6",
    "Trésorerie d'au moins 100 000 PO après une rencontre de ligue.",
    "jeu-en-ligue",
    [
      {
        id: "table",
        label: "Table",
        caption: "Tableau des erreurs coûteuses (selon la Trésorerie en pièces d'or)",
      },
      { id: "effets", label: "Effets", caption: "Effets des résultats" },
    ],
  ),
];

const SHEETS_BY_ID = new Map(SHEETS.map((s) => [s.id, s]));

/** Fiche par identifiant ; `undefined` si l'id est inconnu (deep-link). */
export function getSheet(id: string): Sheet | undefined {
  return SHEETS_BY_ID.get(id);
}
