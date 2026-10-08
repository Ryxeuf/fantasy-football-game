# Design — mode de saisie de la feuille de coupe

## Context

Voir `proposal.md` (Why). État du code utile ici :

- La feuille de coupe EST la feuille de ligue (`LeagueMatchSheet` polymorphe,
  même service, même page web). La différence de compétition tient dans un
  jeu de règles nommé, `CompetitionSheetRules`, servi à l'UI sous
  `competitionRules` (`services/competition-match-sheet-context`). Le jeu de
  coupe est aujourd'hui une CONSTANTE (`CUP_SHEET_RULES`), posée par
  `resolveCompetitionPairing`, qui charge déjà la coupe de la rencontre.
- La page web n'a qu'un seul aiguillage de coupe (`isCup`), qui masque les
  onglets « Fin du match » et « Évolutions ». Le formulaire d'évènement, lui,
  est le même qu'en ligue (`page.tsx`, 1 762 lignes).
- La validation de coupe matérialise le journal en `LocalMatchAction`
  (`sheetEventsToLocalMatchActions`, pur). Une sortie sur blocage y compte
  SANS gravité (`opponentState: "elimine"` d'office) ; une agression ne
  compte que si elle porte une gravité.
- Le `meta` d'un évènement est un objet libre dans le schéma Zod d'ajout.
- `updatePreMatch` n'écrit que les champs présents dans le corps
  (`!== undefined`) : un envoi limité au forfait ne touche à rien d'autre.
- `PATCH /cup/:id` accepte déjà le barème et les départages en cours de
  coupe, avec la même justification (le classement est dérivé).
- La feuille papier (`lib/competition-pdf/adapters/match-sheet.ts`) lit
  `competitionRules` pour masquer ses sections de ligue.
- `prisma/migrations/` est gitignoré : la prod est en `db push`, aucun
  backfill possible.

## Goals / Non-Goals

**Goals :**

- Un SEUL endroit qui dit ce que demande chaque mode, lu par l'écran ET par
  le papier.
- Aucune divergence serveur entre les modes : même validation, mêmes
  données acceptées, même classement.
- Les coupes existantes ne changent pas d'un pixel tant que leur
  commissaire ne touche pas au réglage.

**Non-Goals :**

- Toucher à la feuille de ligue : elle reste en saisie complète, sans
  réglage.
- Refuser côté serveur les évènements « hors profil » : le mode n'est pas
  une règle de validation (voir D3).
- Une saisie de ronde en masse (relève d'un futur mode tournoi, écarté
  pendant l'exploration).
- Les égalités de play-off (aucun qualifié désigné) : sujet séparé, suggéré
  en tâche à part.

## Decisions

### D1 — Colonne `Cup.sheetEntryMode String?`, `null` = complète, SANS `@default`

Valeurs `"full" | "simplified"`. `null` se lit `full` : c'est l'état de
toutes les coupes existantes, sans reprise. La création écrit
EXPLICITEMENT `"simplified"` quand le corps ne précise rien — même posture
que `playoffsPublished`, où c'est `startPlayoffs` qui écrit le `false`.

- *Rejeté : `@default("simplified")`.* Sur Postgres, `db push` ajoute la
  colonne avec `DEFAULT`, ce qui REMPLIT les lignes existantes : toutes les
  coupes en cours passeraient en simplifié, contre la décision prise.
- *Rejeté : un booléen `simplifiedSheet`.* Une chaîne laisse la place à un
  troisième profil sans nouvelle colonne, et se lit sans ambiguïté dans un
  JSON d'API.

Un parseur pur, `parseSheetEntryMode(raw: unknown)`, ramène toute valeur
inconnue à `full` : une ligne corrompue n'est jamais servie à moitié.

### D2 — Le mode voyage dans `CompetitionSheetRules.entryMode`

`CompetitionSheetRules` gagne `entryMode: "full" | "simplified"`.
`LEAGUE_SHEET_RULES` vaut `full`. `CUP_SHEET_RULES` reste la constante de
référence (en `full`), et `cupSheetRules(mode)` en dérive le jeu de la
coupe ; `resolveCompetitionPairing` lit `sheetEntryMode` dans le `select`
qu'il fait déjà. Aucune requête de plus, et l'UI reçoit le mode là où elle
lit déjà le reste des règles.

- *Rejeté : servir `cup.sheetEntryMode` à part dans la réponse de la
  feuille.* Ce serait un second canal pour une information de même nature
  que `sppEnabled`, et l'adaptateur PDF devrait apprendre à le lire.

Côté web, `entryMode` est OPTIONNEL dans le type de `competitionRules` : un
serveur antérieur ne le sert pas, la page retombe alors en saisie complète.

### D3 — Le mode gouverne le formulaire, jamais la validation

Le serveur accepte tout évènement valide quel que soit le mode. C'est ce qui
rend le réglage modifiable à tout moment : une feuille commencée en complet
garde ses coups d'envoi et ses blessures, la timeline les affiche, et
rien de ce qui compte ne bouge. Un refus serveur des types « hors profil »
casserait toute feuille en cours lors d'un changement de mode, et créerait
une divergence de règle entre ligue et coupe sur le même code.

### D4 — Un profil de saisie PUR, partagé par l'écran et le papier

Module pur `apps/web/app/lib/sheet-entry-profile.ts` :

```ts
sheetEntryProfile({ competitionKind, competitionRules }) => {
  mode: "full" | "simplified",
  eventKinds: readonly EventKindOption[], // 13 ou 5, libellés compris
  halfAndTurn: boolean,
  injuryDetails: boolean,   // gravité + séquelle
  passReceiver: boolean,
  preMatch: "full" | "forfeit-only",
  journeymanPosition: boolean,
  raiseDead: boolean,
}
```

La page de la feuille et l'adaptateur PDF en partent tous les deux, ce qui
garantit que ce qu'on note à table correspond à ce qu'on saisit ensuite.
Même posture que `buildSheetSummaryOptions` (« une définition, plusieurs
consommateurs qui ne peuvent pas diverger »).

En simplifié, les cinq types et leurs libellés sont : Touchdown, Sortie sur
blocage (`casualty`), Sortie sur agression (`aggression`, voir D5), Passe
réussie, Interception. La cible est libellée « Victime » pour les deux
sorties.

- *Rejeté : multiplier les `isCup && simplified` dans `page.tsx`.* La page
  fait déjà 1 762 lignes, et chaque condition éparse devrait être recopiée
  dans le PDF.

### D5 — Sortie sur agression : marque `meta.eliminated`, lue par la seule matérialisation de coupe

Le type simplifié « Sortie sur agression » écrit `kind: "aggression"`, la
victime, et `meta.eliminated: true`, sans gravité.
`sheetEventsToLocalMatchActions` compte une agression comme sortie si
`injurySeverity` est posée OU si `meta.eliminated` est vrai. Les tops
d'agresseurs et de victimes lisent `opponentState: "elimine"` : ils suivent
sans changement.

- *Rejeté : une gravité par défaut (« Commotion »).* Elle invente une
  donnée, que la saisie complète afficherait ensuite comme saisie.
- *Rejeté : une valeur de gravité neutre dans l'enum.* Elle entrerait dans
  le pipeline de blessures de LIGUE (persistance, « sac de frappe » via
  `isInjurySeverity`), pour un besoin propre à la coupe.

La timeline affiche « [Sortie] » pour une agression marquée sans gravité.
Le summarizer de ligue n'est pas modifié : en coupe, la liste « Blessures »
de la feuille ne la mentionne pas, ce qui est sans conséquence (une coupe
ne persiste aucune blessure).

### D6 — Écran simplifié : un seul écran, sans onglets

En simplifié, la feuille de coupe n'a plus d'onglets : le forfait (seul
champ d'avant-match) est posé au-dessus du journal. Le panneau d'avant-match
réduit n'envoie que `{ forfeitSide }`, que `updatePreMatch` fusionne sans
toucher aux autres colonnes (vérifié). Les évènements sont ajoutés sans
`half` ni `turn` (la matérialisation retombe sur 1/1, comme aujourd'hui), et
la timeline masque ses séparateurs de mi-temps.

Les panneaux de journaliers et de mort relevé disparaissent ; les
journaliers restent dans les sélecteurs, au poste par défaut que la
dérivation leur donne déjà. Le panneau des rosters reste.

Le bandeau « Coupe — mode résurrection » annonce le mode et renvoie à
`/aide#saisie-de-coupe`.

### D7 — Création et édition

- `createCupSchema` et `updateCupSchema` acceptent
  `sheetEntryMode: z.enum(["full", "simplified"]).optional()`.
- `POST /cup` écrit `body.sheetEntryMode ?? "simplified"`.
- `PATCH /cup/:id` l'ajoute à ses champs modifiables, sans verrou de ronde :
  même justification que le barème. Une coupe archivée reste refusée par la
  règle existante.
- Web : un choix à deux options (« Simplifiée — recommandé » pré-sélectionné
  à la création, valeur courante à l'édition), avec une phrase d'explication
  et un lien vers l'aide.
- `seed.ts` : les coupes de démonstration écrivent explicitement leur mode,
  pour qu'une base de dev montre les deux.

### D8 — Feuille papier simplifiée

L'adaptateur PDF lit le même profil (D4). En simplifié : en-tête et forfait,
une page par équipe avec une case par joueur pour TD / Sor / Agr / Pas /
Int, un journal réduit (type, acteur, victime), les signatures. Pas de
popularité, coups de pouce, prières, météo, pile ou face, table de coup
d'envoi ni légende de gravité. La mise en page exacte se règle à
l'implémentation, sous le flag existant `competition_pdf_exports`.

### D9 — Aide : un champ `details` optionnel sur les cartes

Une carte d'aide n'a aujourd'hui qu'une description d'une ou deux phrases,
trop court pour expliquer deux modes. `HelpFeature` gagne
`details?: readonly string[]`, rendu en liste à puces sous la description.
Nouvelle carte `saisie-de-coupe` dans la catégorie « Coupes » : ce que
demande chaque mode, qui le choisit (le commissaire, à la création et à tout
moment ensuite), le défaut (simplifiée pour une nouvelle coupe), et la
garantie que le classement et les tops sont identiques. Les gardes du
catalogue (ancres uniques, liens vivants) la couvrent.

## Risks / Trade-offs

- [Un `@default` Prisma ajouté par mégarde basculerait toutes les coupes
  existantes] → un commentaire sur la colonne le dit, et un test de route
  vérifie qu'une coupe sans valeur se lit `full`.
- [L'écran et le papier divergent] → un seul profil pur (D4), testé sur les
  deux modes, et un test de l'adaptateur PDF par mode.
- [Un coach saisit pendant que le commissaire change de mode] → seul le
  formulaire change au rechargement ; rien de saisi n'est perdu (D3).
- [Une agression saisie en complet SANS gravité, voulue comme « sans
  effet », n'est jamais confondue avec une sortie] → seule la marque
  explicite `meta.eliminated` en fait une sortie ; aucune déduction.
- [`competitionRules.entryMode` absent d'une réponse serveur antérieure] →
  champ optionnel côté web, repli en saisie complète.
- [La feuille papier reste derrière le flag `competition_pdf_exports`,
  encore en recette] → hors sujet ici ; la version simplifiée en hérite.

## Migration Plan

1. `db push` ajoute la colonne nullable : toutes les coupes existantes
   sont `null`, donc en saisie complète.
2. Le serveur se déploie avant ou après le web indifféremment : le web
   retombe en saisie complète sans `entryMode`, le serveur accepte tout
   évènement.
3. Retour arrière : la colonne est ignorée par le code antérieur ; les
   agressions marquées `meta.eliminated` sont alors comptées comme
   agressions sans sortie, jusqu'au redéploiement.
