# Design — Règlements de tournoi en base + admin

## Décisions

### DB source runtime, registre statique = seed + fallback (précédent RosterStaffConfig)
Alternative rejetée : supprimer le registre statique. Il reste (a) la
source de seed create-only (jamais réécrit → éditions admin préservées),
(b) le fallback quand la table est absente/vide (env non migré, mocks de
tests) ou qu'une ligne est corrompue, (c) le fallback réseau côté web. Un
slug présent en base PRIME sur le statique.

### Json en strings sérialisées + parser tolérant
Convention du repo (cf. `serializeCupRulesData`, CLAUDE.md « Parser
tolerant PG + sqlite ») : écriture `JSON.stringify`, lecture tolérante
objet natif (PG) / string (miroir SQLite). Cas particulier : JSON ne
transporte pas `Infinity` → la tranche de taxe ouverte est stockée et
servie `maxTotalCostK: null`, reconvertie en `Infinity` aux frontières
(parser serveur, fetcher web) pour les helpers purs du moteur.

### Slug immuable, archivage soft, pas de hard delete
`Team/League/Cup.tournamentRuleset` référencent le slug SANS contrainte
FK : renommer ou supprimer casserait silencieusement les références. Le
slug est donc absent du schéma d'update, et la « suppression » est un
`archivedAt` réversible et idempotent (pattern statut d'archive
admin-leagues).

### Deux niveaux de résolution : sélection vs référence
- `resolveTournamentRulesetSelection` (nouvelle sélection — création
  d'équipe/ligue/coupe) : refuse inconnu ET archivé.
- `getTournamentRulesetRecord` (référence existante — labels, pack d'une
  coupe au build Flow B) : résout aussi les archivés.
Cas limite traité : l'édition d'une ligue qui CONSERVE son règlement
archivé reste permise (le formulaire renvoie le champ inchangé) ; seul le
passage À un règlement archivé/inconnu est refusé.

### Validation admin en deux couches
Zod (formes/bornes) puis validation sémantique sur la définition
RÉSULTANTE (create : le body ; update : existant ⊕ patch) : rosters
connus de l'édition choisie (`TEAM_ROSTERS_BY_RULESET`), tranches de taxe
strictement croissantes avec l'ouverte en dernier. Changer l'édition d'un
pack dont les rosters ne suivent pas est donc refusé.

### Web via l'API publique, plus de lecture directe du registre
Sans cela, un règlement créé en admin resterait invisible des listes
déroulantes et les badges afficheraient le slug brut. Les labels de badges
viennent soit du serveur (embarqués sur les endpoints équipe, batchés),
soit du hook `useTournamentRulesets` (liste publique en cache module).
Les fonctions PURES du moteur (plan de compétences, taxe) sont conservées
telles quelles : elles consomment la définition fetchée.
