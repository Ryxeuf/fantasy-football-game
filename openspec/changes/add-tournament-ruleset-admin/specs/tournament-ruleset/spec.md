# tournament-ruleset (delta)

Extension de la capability : les règlements de tournoi sont stockés en
base (source de vérité runtime, éditable en admin), le registre statique
`@bb/game-engine` devenant source de seed et fallback. Console admin
complète (lister, créer, modifier, archiver).

## ADDED Requirements

### Requirement: Stockage en base des règlements
Les règlements de tournoi DOIVENT être persistés dans un modèle
`TournamentRuleset` (slug unique, édition/format exigés, règles par
roster, barème SPP, bannis, tranches de taxe — `maxTotalCostK: null` =
tranche ouverte —, inducements, scoring, `archivedAt`). Le slug DOIT être
immuable après création. Les colonnes Json DOIVENT être relues par un
parser tolérant (objet natif PG / string SQLite). Un environnement sans
la table ou sans seed DOIT retomber sur le registre statique
(comportement historique).

#### Scenario: DB prime sur le registre statique
- WHEN le slug `naf_world_cup_2027` existe en base avec un budget édité en admin
- THEN la création d'équipe DOIT appliquer les valeurs de la base, pas celles du code

#### Scenario: Fallback statique
- WHEN un slug du registre statique n'existe pas (encore) en base
- THEN il DOIT rester sélectionnable et résolu depuis le registre statique

### Requirement: Seed create-only depuis le registre statique
Un seeder idempotent DOIT matérialiser en base les packs du registre
statique absents, sans JAMAIS réécrire une ligne existante (éditions
admin préservées). Il DOIT être câblé au seed principal et exécutable en
CLI (`--dry-run`) et depuis l'admin (POST /seed).

#### Scenario: Re-run sans effet
- WHEN le seeder tourne alors que tous les slugs existent déjà
- THEN aucune ligne NE DOIT être modifiée (tout en `skipped`)

### Requirement: Console admin CRUD
Les admins DOIVENT pouvoir lister (archivés inclus, entrées du registre
statique non seedées signalées), créer, modifier et archiver/désarchiver
les règlements via `/admin/tournament-rulesets` (auth admin, audit
`tournamentRuleset.*`, invalidation du cache public à chaque écriture).
La validation DOIT refuser : slug dupliqué (409), rosters inconnus de
l'édition choisie, tranches de taxe non strictement croissantes ou
tranche ouverte pas en dernier — y compris sur la définition RÉSULTANTE
d'une édition partielle.

#### Scenario: Édition d'un budget
- WHEN un admin modifie le budget d'or d'un roster d'un règlement
- THEN la modification DOIT être persistée, auditée, et servie immédiatement par l'API publique (cache invalidé)

#### Scenario: Changement d'édition incompatible
- WHEN un admin passe un règlement en season_2 alors que ses règles par roster contiennent un roster season_3 uniquement
- THEN la mise à jour DOIT être refusée (400) en nommant les rosters inconnus

#### Scenario: Slug immuable
- WHEN un admin édite un règlement
- THEN le slug NE DOIT PAS être modifiable (absent du schéma d'update)

### Requirement: API publique des règlements
`GET /api/tournament-rulesets` DOIT lister les règlements non archivés
(résumés légers, fusion base + registre statique) ;
`GET /api/tournament-rulesets/:slug` DOIT servir la définition complète,
archivés inclus avec un flag `archived`. Le web (builder, formulaires
ligue/coupe, labels de badges) DOIT consommer cette API, le registre
statique ne servant que de fallback réseau.

#### Scenario: Règlement créé en admin visible partout
- WHEN un admin crée un règlement `coupe_maison`
- THEN il DOIT apparaître dans la liste déroulante du builder et des formulaires ligue/coupe sans redéploiement

## MODIFIED Requirements

### Requirement: Choix du règlement à la création d'équipe
La création d'équipe (`POST /team/build`, `POST /team/create-from-roster`)
DOIT accepter un champ optionnel `tournamentRuleset` (défaut : aucun),
résolu EN BASE avec fallback registre statique. Quand un règlement est
actif, le serveur DOIT imposer le budget d'or et le pool de SPP du tier
du roster (valeurs client ignorées), exiger l'édition et le format du
pack, refuser les rosters absents du pack, et persister le slug sur
l'équipe. Un slug inconnu OU ARCHIVÉ DOIT être refusé pour une nouvelle
sélection. Sans règlement, le comportement DOIT rester identique à
l'historique.

#### Scenario: Budget et pool imposés
- WHEN un coach construit une équipe orc avec `tournamentRuleset=naf_world_cup_2027` et `teamValue=2000`
- THEN l'équipe DOIT être créée avec le budget et le pool du tier orc résolus en base (1080 kpo / 44 SPP par défaut)

#### Scenario: Règlement archivé refusé à la sélection
- WHEN un coach choisit un règlement archivé pour une nouvelle équipe
- THEN la création DOIT être refusée (400) en indiquant que le règlement est archivé

#### Scenario: Coupe existante à règlement archivé
- WHEN une équipe est construite pour une coupe créée AVANT l'archivage de son règlement
- THEN le pack de la coupe DOIT être résolu (archivés inclus) et imposé normalement
