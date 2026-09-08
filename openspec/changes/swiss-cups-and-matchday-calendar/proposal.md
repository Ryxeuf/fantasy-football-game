# Ronde suisse des coupes, clôture manuelle et journées repensées

## Why

Cinq retours d'un commissaire de ligue et de coupe :

1. **Les coupes n'ont pas d'appariement.** Une coupe est une liste
   d'inscrits et de matchs locaux créés à la main : aucune ronde, aucun
   système suisse, alors que c'est LE format des tournois Blood Bowl.
2. **Le dernier match d'une saison ne s'invalide plus.** Le dernier résultat
   validé fermait la saison de lui-même (`status = completed`) ; une erreur
   de saisie sur ce match devenait définitive (« Reversion impossible:
   season-completed »). La clôture doit être un acte du commissaire.
3. **La page des journées est austère** : une liste « A vs B + badge », sans
   score lisible, sans mise en avant du match du coach connecté.
4. **Aucune date de rencontre** : une journée dit « à jouer » sans jamais
   dire quand ; les coachs s'organisent hors de l'application.
5. **La poule du coach connecté n'est pas la première affichée.**

## What Changes

- **Ronde suisse dans les coupes** : modèles `CupRound` / `CupPairing`,
  moteur pur `swiss-pairing`, service `cup-rounds`, routes
  `/cup/:id/rounds` (génération, suppression de la dernière ronde) et
  `/cup/pairings/:id/{schedule,cancel}` ; le match local matérialise la
  rencontre (`LocalMatch.cupPairingId`, unique) ; les exempts comptent
  comme une victoire au classement ; vue `CupRoundsView` sur `/cups/[id]`.
- **Clôture manuelle de saison** : `recordLeagueMatchResult` et
  `maybeCompleteRoundAndSeason` complètent la journée (et démarrent les
  playoffs) mais laissent la saison `in_progress` ; `closeSeason` devient le
  seul chemin de clôture (palmarès + clôture thématique) ; le panneau admin
  invite à clôturer quand tout est joué.
- **Date prévisionnelle** : `PATCH /leagues/pairings/:id/schedule` (coachs
  impliqués ou commissaire, `null` efface), statut « Prévu le … »,
  notification interne `league.pairing_scheduled` ; même règle en coupe.
- **Journées repensées** : composant présentationnel `MatchCard` partagé
  (score central, vainqueur en avant, « Mon match », statut, actions),
  cartes de journée avec avancement et filtre À jouer / Jouées.
- **Poule du coach en premier** : helper pur `putPoolFirst`, appliqué aux
  classements par poule et au groupement du calendrier.

## How

Voir `design.md`. Chaque point est un commit atomique sur la même branche,
testé unitairement (server + web) et par des specs e2e-api sur vraie base
SQLite (`leagues-season-manual-close`, `leagues-pairing-schedule`,
`cup-swiss-rounds`).

## Non-goals

- Pas d'appariement suisse en ligue (la ligue reste en round-robin, poules
  et playoffs) ; le moteur pur est réutilisable si le besoin vient.
- Pas de saisie de feuille de match en coupe : le résultat reste celui du
  match local (`POST /local-match/:id/complete`).
- Pas de départage spécifique « ronde suisse » (Buchholz…) : le classement
  de coupe existant (points, diff TD, TD marqués, victoires, nom) fait foi.
