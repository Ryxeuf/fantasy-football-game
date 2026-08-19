# Design — Aide de jeu

## Contrainte structurante : ne pas dupliquer les règles

Le repo a déjà deux représentations des règles (cf. `CLAUDE.md`) : la
transcription fidèle `.md` (non publiée, risque PI) et le résumé
reformulé `.json` (publié). En ajouter une **troisième**, recopiée à la
main dans l'aide de jeu, garantirait une dérive silencieuse : une
correction de règle mise à jour dans le `.json` laisserait l'aide de jeu
périmée, sans que rien n'échoue.

Décision : **l'aide de jeu ne stocke aucune table.** Elle référence les
tables existantes et les extrait au build.

### Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Copier les tables dans un JSON dédié | Troisième source de vérité, dérive garantie, et re-crée le risque PI. |
| Générer les fiches depuis les `sourcePages` du `.md` | Le `.md` est la transcription littérale non publiable. |
| Charger les tables via l'API serveur | Aucun besoin : le contenu est statique, une requête réseau ne ferait que retarder l'affichage. |

### Extraction : par caption, avec échec bruyant

```ts
export function tableFromChapter(slug: string, caption: string): CompendiumTable {
  const chapter = getChapter(slug);
  const block = chapter?.blocks.find(
    (b) => b.type === "table" && b.caption === caption,
  );
  if (!block) throw new SheetSourceError(slug, caption);
  return block;
}
```

Un `throw` plutôt qu'un `?? null` : la table est un **contrat** avec le
compendium. Si un caption change, `sheets.test.ts` casse et le renommage
est traité dans le même commit, comme l'exige la règle de synchro
`.md` ↔ `.json`. Un fallback silencieux publierait une fiche vide.

## Météo et prières : la seule exception

Ces deux tables **n'existent pas dans le compendium** — elles vivent dans
`@bb/game-engine` (`WEATHER_TYPES`, `PRAYERS_TABLE`), déjà en français et
déjà reformulées. On les consomme telles quelles plutôt que de les
recopier dans le compendium : `apps/web` transpile déjà `@bb/game-engine`
(`next.config.mjs`), et ce sont des constantes pures, sans dépendance
runtime.

Conséquence assumée : la météo affichée est celle de **Nuffle Arena**
(12 types de terrain, dont des variantes maison), pas seulement la table
classique du livre. C'est un plus pour le companion — le sélecteur de
terrain est explicite dans l'UI.

## Panneau : un seul composant, deux présentations

Le bottom-sheet mobile et le panneau latéral desktop sont **le même
composant** (`SheetPanel`), différenciés en CSS pur (`sm:` breakpoints).
Pas de détection de largeur en JS : elle casse au SSR et provoque un
flash au montage.

- Mobile : `fixed inset-x-0 bottom-0`, `max-h-[85vh]`, coins hauts
  arrondis, poignée, `overflow-y-auto` interne.
- Desktop (`sm:`) : `sm:inset-y-0 sm:right-0 sm:w-[420px]`, pleine hauteur.

Accessibilité : `role="dialog"` + `aria-modal`, focus déplacé sur le
panneau à l'ouverture et rendu au déclencheur à la fermeture, `Escape`
ferme, scroll du body verrouillé tant que le panneau est ouvert.

## Deep-link `?fiche=<id>`

`history.pushState` à l'ouverture, `history.back()` à la fermeture, et
un écouteur `popstate` qui synchronise l'état. Le bouton retour du
téléphone ferme donc le panneau au lieu de quitter la page — le réflexe
attendu sur mobile.

On n'utilise pas `useRouter().push` de Next : il re-rend l'arbre serveur
pour un simple changement de query, ce qui fait clignoter une page
entièrement statique.

## Checklist : `localStorage`, une clé par liste

```
nuffle_aide_de_jeu:pre-match  → ["popularite", "meteo"]
nuffle_aide_de_jeu:turn       → ["blitz"]
```

Lecture dans un `useEffect` (jamais pendant le render) pour que le HTML
serveur et le premier render client soient identiques — sinon Next
signale une erreur d'hydratation. `localStorage` indisponible (mode
privé, quota) est traité comme « rien de coché » : la page reste
utilisable en lecture seule.

Pas de compte, pas de serveur : la checklist accompagne **une** partie,
sur **un** appareil, et un bouton « Réinitialiser » la vide.

## Découpage des fichiers

```
app/aide-de-jeu/
  page.tsx              server — metadata, JSON-LD, ISR 3600
  layout.tsx            server — disclaimer GW (comme le compendium)
  AideDeJeuClient.tsx   client — orchestration panneau + checklist
  data/
    sequences.ts        contenu neuf : les 3 phases et leurs étapes
    sheets.ts           extraction des fiches (compendium + engine)
    sheets.test.ts
    sequences.test.ts
  components/
    PhaseTabs.tsx       navigation basse collante
    StepCard.tsx        une étape + ses pastilles de fiche
    SheetPanel.tsx      bottom-sheet / panneau latéral
    SheetContent.tsx    rendu d'une fiche (table, liste, texte)
  useChecklist.ts       persistance localStorage
```

Chaque fichier reste sous 400 lignes ; `sequences.ts` est du contenu, pas
de la logique.
