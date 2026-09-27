# Design — exports PDF des compétitions

## Architecture

```
apps/web/app/lib/competition-pdf/
  types.ts          modèles de VUE (aucune notion d'API ni de compétition)
  theme.ts          palette impression, pdfSafe (WinAnsi), formats po
  layout.ts         en-tête, bandeau courant, pied « Page i / N », champs
  tables.ts         autotable : cellule d'équipe 2 lignes, styles, drawTable
  write-grid.ts     grilles « à remplir » dessinées à la main
  reference.ts      tables lues dans le moteur (coup d'envoi, prières, météo)
  documents/        un gabarit par document (+ roster de la feuille)
  adapters/         API → modèles de vue : league, cup, match-sheet (PURS)
  render.ts         point d'entrée SYNCHRONE (Node et navigateur)
  download.ts       chargement dynamique + doc.save (écran)
  filename.ts       noms de fichiers, module léger
  fixtures.ts       jeux d'exemple (tests et PDF de démonstration)
```

Deux couches strictement séparées :

- **Gabarits** : ne connaissent que les modèles de vue. Une ligue et une coupe
  produisent le MÊME `StandingsDocument`, le même `BracketDocument`… Le jour où
  la coupe gagne une colonne, c'est son adaptateur qui change, pas un second
  gabarit (même règle que « une coupe est une ligue moins ses effets »).
- **Adaptateurs** : purs, testables sans DOM ni réseau. Ils résolvent tout
  libellé (roster lisible, statut traduit, date formatée) : le rendu n'a
  aucune règle métier à redériver.

## Décisions

### Rendu client avec jsPDF, pas de génération serveur

jsPDF + jspdf-autotable sont déjà en dépendances (récap de match local, fiche
coach, rosters). Générer côté client évite toute route, tout stockage et toute
question d'autorisation supplémentaire : le PDF ne contient que ce que l'écran
a déjà le droit de lire (les lectures passent par les mêmes routes, donc par
les mêmes gardes de visibilité des ligues privées).

Coût : le rendu pèse ~400 ko. Il est chargé **au clic** (`download.ts` fait un
`import("./render")`), et `filename.ts` est isolé pour que l'écran n'importe
rien de lourd statiquement.

Alternative écartée : `window.print()` d'une vue HTML dédiée. Rendu dépendant
du navigateur, pagination non maîtrisée, impossible de garantir une feuille
de rencontre en 5 pages paysage.

### Pensé pour l'impression

Fond blanc (le récap de match local utilise un fond parchemin pleine page,
inadapté à une imprimante de club), un seul accent bronze, aplats pâles et
ponctuels qui survivent à une photocopie noir et blanc.

Les polices standard de jsPDF n'encodent que WinAnsi : `pdfSafe` remplace
flèches et comparateurs par un équivalent ASCII et retire emojis et
pictogrammes (sinon un nom d'équipe avec emoji sort en caractères parasites).

### La feuille de rencontre suit la feuille du site

Les codes du journal (`TD`, `SOR`, `AGR`…) et les codes de blessure
(`C`, `A`, `BP`, `S`, `M`) reprennent les types et gravités de la saisie
(`EVENT_KINDS`, `INJURY_SEVERITIES`). La table de coup d'envoi et celle des
prières sont LUES dans le moteur (`KICKOFF_EVENTS`, `PRAYERS_TABLE`) — même
source que la liste déroulante du site, donc pas de quatrième représentation
à maintenir (cf. le compendium). La page de fin de match suit l'ordre du livre
(p.68) : un coach qui remplit la feuille dans l'ordre respecte la séquence.

Les règles de compétition (`competitionRules` servi par l'API) décident des
sections : sans économie, pas de gains ni d'étape 5 ; sans évolution, pas
d'étape 3 ; sans PSP, pas de colonnes PSP. Sans règles servies (serveur
antérieur), une ligue applique tout et une coupe rien.

Pré-remplissage : ce qui est saisi est reporté (avant-match, journal,
compteurs par joueur relus dans le résumé ET les évènements, JDM). Les PSP de
match ne sont reportés qu'une fois la saisie entamée.

### Prochaine journée

Première journée non terminée (ligue) / première ronde ayant une rencontre
ouverte (coupe), sinon la dernière. Les rencontres se groupent par poule de
l'équipe à domicile ; une seule poule représentée donne un affichage à plat,
et une ronde de bracket ne se groupe jamais (même règle que le calendrier).

### Score affiché

Ligue : le score de la feuille VALIDÉE uniquement (source unique du
résultat) ; une feuille soumise mais non validée n'imprime rien. Coupe : le
match local complété, orienté domicile/extérieur (le match local a ses propres
côtés A/B). D'où l'ajout serveur du `matchSheet` au bracket de ligue.

## Risques

- **Gabarit figé côté client** : un changement de colonnes du classement doit
  être reporté dans l'adaptateur. Couvert par les tests d'adaptateurs.
- **Taille** : une ligue de 16 équipes en une poule tient sur une page de
  classement ; au-delà, autotable pagine (bandeau courant répété).
