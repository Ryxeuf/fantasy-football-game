# Règlements de tournoi en base + console admin (lister / créer / modifier / archiver)

## Why

Les règlements de tournoi vivaient uniquement dans le registre pur
`@bb/game-engine` (`TOURNAMENT_RULESETS`) : ajouter un pack, corriger un
budget ou retirer un règlement du catalogue exigeait un déploiement. Le
besoin : les stocker en base et donner aux admins un CRUD complet —
lister, créer, modifier, archiver — comme pour les rosters
(`Roster`/`RosterStaffConfig`, DB source runtime + statique en seed et
fallback).

## What Changes

- **Modèle `TournamentRuleset`** : slug unique (référencé par
  `Team/League/Cup.tournamentRuleset`, IMMUABLE), édition/format exigés,
  colonnes Json écrites en string sérialisée (PG + miroir SQLite, parser
  tolérant, `maxTotalCostK: null` ↔ tranche de taxe ∞), soft-archive
  `archivedAt` (pas de hard delete : références par slug). Migration
  additive + seed create-only depuis le registre statique
  ([`scripts/seed-tournament-rulesets.ts`](../../../apps/server/src/scripts/seed-tournament-rulesets.ts)).
- **Repository DB→fallback**
  ([`services/tournament-ruleset-repository.ts`](../../../apps/server/src/services/tournament-ruleset-repository.ts)) :
  `resolveTournamentRulesetSelection` (NOUVELLE sélection : slug inconnu
  OU archivé refusé), `getTournamentRulesetRecord` (archivés résolus —
  labels, coupes existantes), labels batchés anti-N+1, listing fusionné
  DB + statique. Tous les consommateurs (build, create-from-roster,
  ligues, coupes, inscriptions) rebranchés ; un environnement non
  migré/seedé retombe sur le registre statique (comportement historique).
- **API publique** `GET /api/tournament-rulesets[/:slug]`
  (pattern public-rosters : cache 5 min + invalidation admin) — le web
  (builder, formulaires ligue/coupe, badges) consomme l'API, registre
  statique en simple fallback réseau.
- **Admin** : routes `/admin/tournament-rulesets`
  (list/GET/POST/PUT/archive/unarchive/seed, `authUser`+`adminOnly`,
  audit `tournamentRuleset.*`, validation sémantique : rosters connus de
  l'édition, tranches croissantes, ouverte en dernier) + console
  `/admin/data/tournament-rulesets` (liste avec états, formulaire complet
  avec table des règles par roster, « Matérialiser les packs du code »).
- **Sémantique d'archivage** : un règlement archivé n'est plus proposé ni
  acceptable pour de NOUVELLES équipes/ligues/coupes ; les entités qui le
  référencent restent valides (labels, build Flow B d'une coupe
  existante, édition d'une ligue qui le conserve).

## Out of scope (suivi)

- Suivis hérités du change précédent (Elite Skills officiels du pack NAF,
  escouades, résurrection côté ligues, inducements de match).
- Éditeur admin « riche » des inducements/bannis (sélecteurs depuis les
  catalogues) — v1 en saisie slug/CSV.
- Duplication d'un règlement (« créer à partir de ») — POST /seed couvre
  la matérialisation des packs du code.

## Impact

- **Capability** : `tournament-ruleset` (étendue : stockage + admin).
- **Migration** : `20260824120000_add_tournament_ruleset_model` (additive).
- **Tests** : repository/seed (20), API publique (4), admin routes (16),
  formulaire admin web (3) ; suites serveur + web complètes vertes.
