---
"@bb/server": minor
"@bb/web": minor
---

Règlements de tournoi stockés en base et administrables : nouveau modèle `TournamentRuleset` (slug immuable, soft-archive, seed create-only depuis le registre `@bb/game-engine` qui reste le fallback), console admin `/admin/data/tournament-rulesets` (lister, créer, modifier, archiver/désarchiver, matérialiser les packs du code) avec audit et validation sémantique (rosters de l'édition, tranches de taxe), API publique `GET /api/tournament-rulesets[/:slug]` consommée par le builder, les formulaires ligue/coupe et les badges (labels résolus en base, y compris pour les règlements créés en admin). Un règlement archivé n'est plus proposé ni accepté pour de nouvelles équipes/ligues/coupes ; les entités qui le référencent restent valides.
