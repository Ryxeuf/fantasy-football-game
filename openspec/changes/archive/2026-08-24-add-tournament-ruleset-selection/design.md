# Design — Règlements de tournoi

## Décisions

### Troisième axe orthogonal, pas une extension du `ruleset`
`ruleset` désigne l'édition (season_2/season_3) et `format` la variante
(bb11/sevens). Un pack de tournoi *référence* une édition et un format
(NAF WC 2027 → season_3 + bb11) mais n'en est pas un : on ajoute
`tournamentRuleset` (3e axe), sur le modèle éprouvé de `formats.ts`
(constantes pures dans `@bb/game-engine`, consommées par le serveur ET
le builder web).

### Slug `String?` plutôt qu'enum Prisma
- Alternative rejetée : enum Prisma `TournamentRuleset`. Chaque nouveau
  pack imposerait une migration d'enum (pénible côté PG, sans objet côté
  miroir SQLite) alors que la validation vit déjà dans le registre
  applicatif.
- Retenu : slug `String?` validé par `parseTournamentRuleset` (slug
  inconnu → 400, pas de fallback silencieux — le pack conditionne budget
  et restrictions). Précédent dans le schéma : `Team.roster` est un slug
  string validé applicativement.

### Égalité stricte des deux côtés à l'inscription
Le besoin exprimé est « une compétition à règlement force ses équipes ».
On refuse AUSSI le sens inverse (équipe à règlement dans une compétition
standard) : une équipe NAF WC démarre avec 1 080–1 200 kpo et des
compétences gratuites — la laisser entrer dans une ligue/coupe standard
fausserait la compétition. Symétrie appliquée dans `addParticipant`
(source de vérité join direct + invitation) et `registerTeamToCup`, et
reflétée dans les filtres d'éligibilité côté web.

### Budget/pool imposés côté serveur, valeurs client ignorées
Même posture que le Flow B coupe : quand un pack est actif, le serveur
recalcule `finalTeamValue` (budget d'or du tier) et `startingPspPool`
(SPP du tier − taxe Star Players) sans faire confiance au client. Une
coupe **avec** règlement l'impose au build (et le pack prime sur ses
`tierBudgets`) ; une coupe **sans** règlement refuse une équipe à
règlement (sinon le pack contournerait les budgets de la coupe).

### Barème de compétences injecté, pas dupliqué
`applyCupBuildAdvancements` prend un `BuildAdvancementCostFn` optionnel
(défaut : barème BB `getNextAdvancementPspCost`, inchangé). Le handler
injecte `tournamentSkillCost(pack, …)` quand un pack est actif. Nota :
pour les choix primaire/secondaire, le barème BB2025 (6/8 et 10/12) est
identique à celui du pack — l'injection sert la divergence future
(surcoût Elite) et interdit les types aléatoires/caractéristique via
`validateTournamentSkillPlan` en amont.

### Taxe SPP décomptée à la création, pool stocké net
`startingPspPool` persiste le pool réellement dépensable en compétences
(SPP du tier − taxe). L'affichage « pool / dépensés / restants » de la
fiche d'équipe reste vrai sans nouvelle colonne ; l'inscription à une
coupe à règlement accorde ce pool comme `pspPoolGranted`.

### Transcription du pack
Tableau des tiers extrait du PDF (positions x/y du texte) ; les
marqueurs cumul/étoile, portés par des tracés vectoriels, ont été
reconstitués par analyse des glyphes (3 courbes = cumul 1 joueur,
6 = cumul 2 joueurs, 11 = étoile) et rattachés aux lignes d'équipes par
coordonnées. « Skrorg Snowpelt » du pack correspond au slug
`skorg_snowpelt` du catalogue ; « Grak and Crumbleberry » bannit les
deux slugs de la paire.
