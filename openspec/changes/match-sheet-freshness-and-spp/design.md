# Design — feuille à jour, PSP complets

## 1. Garde d'ouverture plutôt que gel tardif

Le gel à l'ouverture est voulu (« Gel version du match : tout, dès
l'OUVERTURE », CLAUDE.md) : il empêche les valeurs de bouger pendant la
saisie. Le défaut n'est pas le moment du gel mais l'état dont il part. Deux
réponses complémentaires :

- **Garde** : refuser l'ouverture tant qu'une rencontre d'une journée
  ANTÉRIEURE de la même saison, impliquant l'une des deux équipes, n'est ni
  jouée, ni forfait, ni annulée. C'est la proposition retenue sur Discord
  (« on peut bloquer les feuilles si J pas validée »).
- **Bypass commissaire** (`force: true`) : en ligue physique, une journée
  reportée se joue parfois après la suivante. Un blocage dur gèlerait la
  ligue ; un simple avertissement ne protégerait de rien. Le coach est
  bloqué, le commissaire est averti et décide.

Alternatives écartées :

- *geler à la première soumission* : rouvre la fenêtre où les valeurs
  bougent pendant la saisie (bug déjà corrigé une fois) ;
- *geler à la validation de la journée précédente* : il faudrait un
  déclencheur sur toutes les feuilles ouvertes des équipes, et l'ordre réel
  des matchs n'est pas connu du serveur.

La garde est best-effort : une lecture en échec n'empêche pas d'ouvrir (elle
protège d'un oubli, ce n'est pas une frontière de sécurité). Les coupes ne
sont pas concernées : leur feuille rejoue le roster d'inscription.

## 2. Fraîcheur détectée, mise à jour manuelle

La garde ne couvre ni l'ouverture forcée, ni l'invalidation de J après
l'ouverture de J+1 (`canInvalidateMatchSheet` l'autorise tant qu'une des deux
équipes n'a pas rejoué). D'où :

- **Détection sans colonne** : chaque gel porte déjà `capturedAt` (ms) ; un
  gel qui n'en a pas se date par la création de la feuille (c'était l'heure
  du gel). Périmé = une autre feuille de LIGUE de l'équipe validée ou
  invalidée après. Une requête, bornée au plus ancien gel des deux côtés.
- **Mise à jour humaine, pas automatique** : le serveur ne sait pas si la
  rencontre a vraiment été jouée avant ou après (journée reportée). Le coach
  ou le commissaire clique ; la feuille dit pourquoi.
- **Fenêtre : jusqu'à la première soumission.** Soumettre vaut « ma saisie
  porte sur cet état » ; il suffit de retirer sa soumission pour rouvrir.
- **Ce qui est gardé** : avant-match, évènements, choix de postes des
  journaliers (les choix sont stockés, les journaliers dérivés). **Refus** si
  la saisie cite un joueur que le nouveau gel ne connaît plus — perdre un
  évènement en silence serait pire que demander une correction.
- **Bouton toujours disponible en brouillon**, discret quand rien n'est
  détecté : une correction de roster par le commissaire ne passe pas par une
  feuille.

## 3. Élimination soignée

`eliminationEarnsSpp` exigeait une gravité : sans blessure, pas
d'élimination. C'est confondre l'élimination (le résultat du jet) et la
blessure qui en RESTE. Deux prédicats distincts :

- `eliminationOccurred` : Élimination sur Blocage / sur Action Spéciale =
  élimination par le type (le libellé l'affirme) ; agression, atterrissage,
  public, auto-élimination = seulement si la saisie le dit
  (`isEliminationOutcome` : une gravité ou `healed`).
- `isInjurySeverity` : inchangé, réservé à ce qui se PERSISTE (absence,
  blessure persistante, séquelle, mort) et aux règles de blessure (Haine,
  joueur relevé).

`healed` vit dans la même colonne que la gravité (pas de colonne, pas de
backfill) ; il n'entre jamais dans `summary.injuries`. Le « sac de frappe »
compte les éliminations soignées : le joueur a bien été éliminé. La coupe
comptait déjà une `casualty` sans regarder la gravité : la ligue s'aligne.

## 4. Lancer Sécurisé

`team_throw` crédite `safeThrows` à son acteur (le lanceur), 1 PSP sans
modificateur d'équipe. L'atterrissage reste un évènement distinct : un lancer
réussi peut finir sur un atterrissage raté. Le compteur entre dans le
snapshot `offlineResultInput` : l'invalidation, qui relit ce snapshot,
reprend exactement ce qui a été crédité.

## 5. Rattrapage du passé

`prisma/migrations/` est gitignoré (prod = `db push`) : pas de backfill. Le
rattrapage paresseux existant (`healSeasonCasualties`, joué par le
classement, fenêtre VERSIONNÉE) suffit : `CASUALTY_RULE_VERSION` passe à 2,
et `planCasualtyResync` compare aussi les Lancers Sécurisés (absents des
anciens snapshots, lus 0). Un joueur sans ligne de stats à la validation
récupère aussi son match joué (`newStatLine`) — l'invalidation le reprend
déjà pour chaque ligne du snapshot ; latent pour les sorties ajoutées sous
Frénésie d'Agression. Limite assumée : les saisons clôturées ne sont pas
reprises.
