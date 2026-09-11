# Une sortie est une élimination qui rapporte des PSP

## Why

Le summarizer de la feuille de match comptait comme « sortie infligée »
toute élimination portant une blessure. Une agression qui blessait créditait
donc son auteur d'une sortie (et de 2 PSP), et le compteur d'équipe — celui
des colonnes Sor+/Sor- du classement et des points bonus « sorties
infligées » — additionnait aussi les sorties par le public, les Actions
Spéciales sans Innovateur Violent et les atterrissages sans Vol Fatal.

Constat sur le premier match d'une ligue : la feuille annonçait 5 sorties
pour 4 éliminations sur blocage + 1 agression. L'anomalie avait déjà été
signalée ; la correction précédente (#1001) n'avait touché que les PSP des
Actions Spéciales et des atterrissages, pas la qualification de « sortie »
elle-même, ni l'agression.

La règle du livre (compendium, chapitre des PSP) est pourtant nette : seule
une Élimination infligée par une Action de Blocage rapporte des PSP ; une
élimination causée autrement (Action Spéciale, blessure par le Public…)
n'en rapporte aucun, sauf exception nommée — compétence ou Prière à Nuffle.

## What Changes

- **Une définition unique de la sortie**, `eliminationEarnsSpp` (pur, dans
  le summarizer) : blocage toujours ; Action Spéciale avec « Innovateur
  Violent » ; atterrissage sur un adversaire avec « Vol Fatal » ; agression
  sous la Prière 13 « Frénésie d'Agression » ; jamais pour le public, une
  esquive ratée, une temporisation. Les compteurs d'équipe
  (`casualtiesHome/Away`) et les stat-lines des joueurs
  (`casualtiesInflicted`) en dérivent tous deux — invariant testé.
- **Une agression reste une agression** : colonne Agr, blessure consignée,
  candidat au trait Haine — mais ni sortie, ni PSP, sauf Frénésie.
- **La Prière 13 « Frénésie d'Agression » est câblée**, reconnue par son jet
  ou son id comme les prières 10 et 11, servie au summarizer par côté.
- **Les options du summarizer d'une feuille sont construites en un seul
  endroit** (`league-sheet-summary-options`, pur) : compétences du coup
  d'envoi relues dans le gel + prières. La feuille (lecture, validation),
  les classements individuels de saison et la resynchronisation d'une
  feuille validée passent tous par là.
- **Les classements « Cogneurs » et « Tueurs » de la saison** ne comptent
  plus que les éliminations qui rapportent des PSP (une Action Spéciale
  sans Innovateur Violent ne classe plus son auteur).
- **Resynchronisation des feuilles déjà validées** : service
  `league-sheet-casualty-resync` (plan pur + application en une transaction,
  journalisée) et script `db:resync-sheet-casualties` (simulation par
  défaut). Rejoue uniquement ce qui dépend des sorties : compteurs des
  participants, `totalCasualties` et PSP des joueurs, bonus du pairing,
  snapshot `offlineResultInput`.
- **Web** : le rappel de règle sous le type d'évènement dit qu'une
  agression compte en agressions, pas en sorties, sauf Frénésie ; la sortie
  par le public renvoie à sa colonne SP.

## Impact

- Serveur : `services/league-match-summary.ts`,
  `services/league-sheet-prayer-spp.ts`, `services/league-match-sheet.ts`,
  `services/league-sheet-frozen-skills.ts`,
  `services/league-sheet-summary-options.ts` (nouveau),
  `services/league-player-stats.ts`,
  `services/league-sheet-casualty-resync.ts` (nouveau),
  `scripts/resync-sheet-casualties.ts` (nouveau), `package.json`.
- Web : `leagues/pairings/[id]/sheet/event-fields.ts`.
- Aucune colonne, aucune migration. Les compteurs persistés des feuilles
  antérieures sont repris par le script, à lancer une fois après
  déploiement (cf. `docs/roadmap/backlog/openspec-suites.md`, « Opérations
  à faire au déploiement »).
- Rupture volontaire : une Action Spéciale sans Innovateur Violent, un
  atterrissage sans Vol Fatal et une sortie par le public ne comptent plus
  dans Sor+/Sor- ni dans les cogneurs ; une agression qui blesse ne
  rapporte plus 2 PSP hors Frénésie d'Agression.
