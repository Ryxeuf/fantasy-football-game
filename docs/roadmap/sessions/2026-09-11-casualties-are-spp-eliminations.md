# 2026-09-11 — Une sortie est une élimination qui rapporte des PSP

> Récit de session. Décision versionnée dans
> `openspec/changes/casualties-are-spp-eliminations/`.

## Le point de départ

Deux lignes de retour : « une ano que je pensais être corrigée » — le
comptage des sorties (des éliminations, plutôt). Seules comptent celles qui
donnent des PSP, pour le bonus comme pour le classement dans la catégorie
sorties ; une agression est comptée dans les agressions, pas dans les
sorties, sauf si le joueur a de quoi gagner des PSP ailleurs que sur une
élimination au blocage. Et le cas concret : sur le premier match de la
ligue, l'appli comptait 5 sorties pour 4 + 1 agression.

## Ce que l'audit a montré

Le summarizer (`league-match-summary`) comptait comme sortie TOUTE
élimination portant une blessure. L'agression qui blessait créditait
`casualtiesInflicted` — donc 2 PSP — à son auteur, et le compteur d'équipe
additionnait aussi les sorties par le public, les Actions Spéciales sans
Innovateur Violent et les atterrissages sans Vol Fatal. La correction
précédente (#1001, « la règle PSP des éliminations enfin dite ») n'avait
gaté que les PSP des Actions Spéciales et des atterrissages — pas le
compteur d'équipe, pas l'agression. Et le classement des cogneurs de saison
(`league-player-stats`) réécrivait une troisième règle : « casualty +
special_elim, quel que soit le porteur d'Innovateur Violent ».

Trois lectures, trois définitions, aucune conforme au livre : seule une
Élimination sur Blocage rapporte des PSP, sauf exception nommée.

## Ce qui a été fait

Cinq commits atomiques, chacun avec ses tests :

1. **La règle** — `eliminationEarnsSpp(event, options)`, pur, devient LA
   définition d'une sortie. Blocage toujours ; Action Spéciale avec
   Innovateur Violent ; atterrissage avec Vol Fatal ; agression sous la
   Prière 13 ; jamais pour le public, une esquive ratée, une temporisation.
   Compteur d'équipe et stat-line en dérivent tous deux (invariant testé).
   Scénario du bug en test : 4 blocages + 1 agression = 4 sorties.
2. **La Prière 13 « Frénésie d'Agression »** — reconnue par son jet ou son
   id comme les prières 10 et 11, mais servie au summarizer par côté : ce
   n'est pas un bonus additif, c'est la qualification de l'agression qui
   change. La feuille (lecture et validation) construit ses options en un
   seul endroit.
3. **Les cogneurs de saison** — évalués feuille par feuille avec le même
   prédicat et les mêmes options (gel du coup d'envoi + prières), via un
   module pur partagé `league-sheet-summary-options`.
4. **La reprise du passé** — `league-sheet-casualty-resync` rejoue les
   seuls deltas qui dépendent des sorties (participants, `totalCasualties` et
   PSP au barème du côté, bonus du pairing, snapshot `offlineResultInput`),
   en une transaction journalisée, idempotent. Script
   `db:resync-sheet-casualties`, simulation par défaut.
5. **Le web** — le rappel de règle sous le type d'évènement dit qu'une
   agression compte en agressions, pas en sorties, sauf Frénésie.

## Ce qui reste

- Lancer le script après déploiement (simulation, lecture du rapport,
  `--apply`) — c'est lui qui ramène le premier match de la ligue à 4 sorties
  au classement ; la feuille, elle, les affiche déjà.
- Prière 12 « Interaction avec les Fans » : il faudrait saisir l'auteur
  d'une sortie par le public. Consignée dans `openspec-suites.md`.
