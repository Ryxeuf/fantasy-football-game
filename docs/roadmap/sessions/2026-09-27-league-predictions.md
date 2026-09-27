# 2026-09-27 — Les pronostics de ligue

> Récit de session. Décision versionnée dans
> `openspec/changes/league-match-predictions/` (à archiver après le merge),
> exploration dans
> [`docs/roadmap/explorations/2026-09-27-pronostics-de-ligue.md`](../explorations/2026-09-27-pronostics-de-ligue.md).

## Le point de départ

« Il me semble qu'on avait déjà parlé d'un système de pronostics. » Oui : une
session du 2026-09-11 (« Paris sur matchs de ligue ») s'était arrêtée sur six
décisions ouvertes, et sa branche avait disparu sans rien consigner. La
demande restait la même — laisser les joueurs pronostiquer les rencontres à
venir de leur ligue, avec une portée réglable par ligue qui compose avec la
visibilité — plus une exigence : « avec de la monnaie mais ne pas pouvoir
s'en servir ne sert à rien ».

## Ce que l'exploration a tranché

Tout ce qui ressemble à un pari et aux Crowns vit dans la Pro League, GELÉE
depuis le 2026-06-01 (le wallet est monté sous `/pro-league/**`, donc 404 en
prod), et aucun puits de Crowns n'existe ailleurs. D'où :

- **un pick'em à points**, pas de cotes ni de mise — une rencontre jouée sur
  table n'a rien à simuler, et sans cote une mise libre revient à « tout sur
  le favori » ;
- **3 points l'issue, nul compris, +2 le score exact**, score facultatif mais
  cohérent avec l'issue ;
- **portée `off | members | open`** par ligue, composée avec
  `isLeagueVisibleTo` ; un coach RETIRÉ n'est plus membre ;
- **rien des autres avant la clôture**, pas même leur nombre ;
- **deux classements, une implémentation** (option A) : Coachs (équipe
  active, N-1 rencontres par journée) et Tribunes (N) — les mêler aurait
  favorisé les tribunes de 14 % à 50 % selon la taille de la ligue ;
- **des points d'abord, des Crowns seulement avec des puits** — la conversion
  reste possible plus tard, rétroactivement, puisque les points se dérivent.

## Ce qui a été fait

### Le règlement vit dans l'entonnoir des résultats

L'exploration voulait dériver le résultat à la lecture. Le code l'en a
empêchée : `Match` n'a pas de colonnes de score — il vit dans la feuille OU
dans l'instantané de saisie, selon le chemin. En revanche, TOUT résultat de
ligue passe par `recordLeagueMatchResult`. Le règlement s'y branche, après la
transaction : on copie l'issue et le score RÉEL sur chaque pronostic, jamais
des points, que le module pur recalcule à la lecture. Changer le barème ne
laissera aucun compteur périmé — la leçon du 2026-09-16.

La reversion (invalidation, édition ex-post) dérègle ; l'édition ex-post
étant une reversion suivie d'une saisie, elle règle de nouveau sans code de
plus.

### La clôture est persistée, pas dérivée

Dériver « fermé » de la feuille (un évènement, une soumission) aurait rouvert
la rencontre à chaque `removeEvent` / `unsubmitByCoach`.
`LeaguePairing.predictionsClosedAt` est donc WRITE-ONCE (`updateMany … where
null`) : premier évènement, première soumission, résultat, forfait, clôture
manuelle. La date prévue, elle, reste une prévision relue à chaque lecture —
sur une ligue datée, le calendrier la cale sur le début de la journée, ce qui
donne « fermé au coup d'envoi de la journée » sans code dédié.

### Trois modules pour ne pas boucler

Premier jet : un seul service, importé par la feuille et l'entonnoir. Il
tirait `league-access` et `league-playoffs`, donc tout `services/league`,
donc… la chaîne des résultats elle-même. Le cycle ne se voyait qu'aux tests :
un mock de `recordOfflineLeagueResult` court-circuité, un test d'édition
ex-post qui renvoyait `pairing-not-terminal-eligible`. Découpage :
`league-predictions-rules` (pur), `league-predictions-core` (appartenance,
classement sans lecteur, statistiques — pour le palmarès et les succès),
`league-predictions-settlement` (clôture, règlement, bilan — pour la chaîne
des résultats), et `league-predictions` pour les seules routes.

### Les gains

- **Oracle de la saison** au palmarès (premier de l'onglet Coachs, ex æquo
  compris), carte au récap masquée quand elle est vide ;
- **cinq succès** dans une catégorie « Pronostics » ;
- **un bilan par journée** (notification interne), au plus une fois grâce à
  `LeagueRound.predictionsNotifiedAt` — une invalidation suivie d'une
  nouvelle saisie ne renvoie rien. Une journée complétée par la CLÔTURE de la
  saison (rencontres restantes annulées) le reçoit aussi : sans quoi une
  journée jouée à moitié n'avait jamais de bilan.

### L'écran

Le réglage de portée entre au formulaire de ligue et au panneau réduit d'une
ligue verrouillée (même posture que l'ordre du classement : une règle de
lecture échappe au verrou). La fiche de ligue gagne un panneau « Pronostics »
(journée ouverte, saisie, haut du classement) qui, sur une ligue antérieure,
n'invite que le commissaire à activer la fonctionnalité ; une page complète
sert toutes les journées, les pronostics nominatifs après clôture et les
deux onglets.

## Ce que la spec e2e a trouvé

`GET /achievements` répondait 500 dès qu'un succès se débloquait sur le
miroir SQLite : `createMany({ skipDuplicates })` n'y existe pas. Invisible
jusqu'ici, faute de spec qui ouvrait l'appel à un coach ayant quelque chose à
débloquer. Remplacé par un `upsert` par succès, portable et idempotent.

Et un classique du repo, rencontré une fois de plus : un serveur e2e resté
vivant d'un run précédent a fait échouer toute la suite en `ECONNREFUSED`.

## Suites

Hors périmètre, à remonter dans `openspec-suites.md` à l'archivage : les
coupes (`cupPairingId`), les Crowns (et leurs puits), un widget « pronostics
à faire » sur l'accueil, une puce « ton prono » dans les cartes du
calendrier, d'autres types de pronostics.
