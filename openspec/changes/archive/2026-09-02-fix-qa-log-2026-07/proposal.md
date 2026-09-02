# Corrections du log QA testeur du 03/07/2026 (ligue physique & évolutions)

## Why

Le testeur beta a livré un log de suivi avec 32 items ouverts (anomalies
A* + évolutions E*), concentrés sur la feuille de match de ligue physique
(FDM), l'édition d'équipe par le commissaire et l'éditeur d'évolutions.
Trois items étaient « Validation KO » : E2/E6 (jamais implémentés tels que
décrits — onglets de catégories) et A6 (implémenté dans le flux normal
mais PAS dans le chemin commissaire, qui n'impactait jamais la valeur
d'équipe — cause du « je ne vois pas de changement »).

## What Changes

### Feuille de match (FDM)
- **A57/A58/A60** : libellés officiels FR des évènements (« Élimination
  sur Blocage », « Sortie (Public) ») et gravités (Commotion / Amoché /
  Blessure Sérieuse / Séquelle / Mort) ; plus d'enum brut anglais dans la
  timeline.
- **A59/A61** : blessure saisissable sur Sortie Public et Agression.
- **A68** : picker « Caractéristique affectée » pour une Séquelle
  (meta.stat), lu par le pipeline offline existant.
- **A67** : un stat_loss sans meta.stat était silencieusement droppé à
  l'application roster → refusé à la saisie (Zod superRefine).
- **A62** : champ Cible masqué pour les évènements qui n'en portent pas ;
  `other_elim` devient une auto-élimination (victime = acteur), sans
  compteur d'élimination infligée ni SPP indus.
- **A63** : gains auto officiels — (pop dom + pop ext) × 10k / 2 + 10k
  par TD de l'équipe (`computeMatchWinnings`), recalculés au pre-match, à
  la lecture et à la validation.
- **A55** : budget coups de pouce underdog — l'extra vient de SA
  trésorerie plafonné à min(50k, dispo) ; la dépense adverse augmente sa
  cagnotte (`calculatePettyCash` : spentTeamA/B + plafond trésorerie).
- **A56** : évènement kickoff → résultat de la table 2D6 (réutilise
  `KICKOFF_EVENTS` du game-engine), stocké en meta.kickoffEvent.
- **E11** : snapshot du roster des 2 équipes figé à la 1re soumission
  (`rosterSnapshotHome/Away Json?` sur LeagueMatchSheet, pattern
  cup-roster-snapshot), consultable dans le résumé de la feuille.

### Édition d'équipe (commissaire + coach)
- **A64** : le commissaire édite nom + numéro (route identity + audit).
- **E12** : le coach édite nom + numéro même équipe ENGAGÉE (route
  cosmétique sans verrou anti-triche, édition inline ✎ sur la fiche).
- **E13** : ajout de compétence via un select des compétences ACCESSIBLES
  (pool primaire+secondaire du poste), validation serveur.
- **A6 (chemin commissaire)** : l'ajout enregistre un vrai avancement et
  incrémente la VE (+20k primaire/hasard, +40k secondaire) ; la
  suppression reverse l'avancement et la VE.
- **E14** : caractéristique saisie en valeur cible (1-10), plus en delta.
- **E15** : compétences innées du poste non supprimables.
- **A65** : abréviations FR M/F/AG/CP/AR affichées.

### Évolutions, ligue, stats, compendium
- **E2/E6** : l'éditeur d'évolutions affiche TOUTES les catégories
  G/A/S/P/M/K — accessibles en bleu cliquables, autres grisées.
- **A11** : règles spéciales + type de ligue exposés et affichés sur la
  fiche roster de ligue (l'impact SPP était déjà câblé).
- **A54** : la saisie manuelle du calendrier respecte les poules
  (rejet serveur different_pools + selects filtrés + affichage groupé).
- **A66** : crash « Statistiques par équipe » (categories manquant dans
  le payload by-team).
- **E16** : classements avec noms d'affichage (plus de slugs underscore).
- **E8** : badge Actif/Passif sur les pages compétences (isPassive
  renseigné depuis les transcriptions internes).
- **E10** : builder custom — jusqu'à 2 compétences empilées par joueur.

### En attente (bloqués sur les pages du livre)
- **A53** (liste des coups de pouce p.142-148) et **A49-A52** (libellés
  exacts Rétablissement/Saut/Sprint/Frappe Précise) : les pages ne sont
  pas transcrites dans docs/regles-bb-2025/ (s'arrête p.24).
- **A16** (listes Star Players) : différé, « à voir plus tard » (cause
  identifiée : mapping hirableBy/TEAM_REGIONAL_RULES trop grossier).
- **A20/A21** : déjà corrects dans le code — réimport DB / re-validation.

## Impact

- Migration Prisma additive : `rosterSnapshotHome/Away` sur
  LeagueMatchSheet (+ miroir sqlite). `migrate deploy` + `generate`
  requis au déploiement ; seed à relancer pour isPassive (E8).
- `calculatePettyCash` change la sémantique de `underdogBonus` (plafond
  trésorerie au lieu de cagnotte gratuite) — jeu en ligne (sans bonus)
  inchangé.
- ~30 tests de non-régression ajoutés (server, web, game-engine).
