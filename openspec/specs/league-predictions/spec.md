# league-predictions

## Purpose

Pronostics sur les rencontres d'une saison de ligue : un pick'em à points,
pas un pari — ni cote, ni mise, ni monnaie. Chacun prédit l'issue d'une
rencontre (et, s'il le veut, son score exact) ; un classement en deux groupes,
Coachs et Tribunes, désigne l'Oracle de la saison.

La capacité tient sur quatre choix, qui ne se voient pas en lisant un seul
écran : la portée se COMPOSE avec la visibilité de la ligue (une ligue privée
reste introuvable, quelle que soit la portée) ; la clôture d'une rencontre
s'écrit une fois et ne s'efface jamais, la date prévue restant une prévision
relue à chaque lecture ; rien des pronostics des autres ne quitte le serveur
avant la clôture ; et l'on stocke le RÉSULTAT d'une rencontre sur chaque
pronostic, jamais des points, que le classement recalcule à la lecture.

## Requirements

### Requirement: Une portée de pronostics par ligue

Une ligue DOIT porter une portée de pronostics parmi `off`, `members` et
`open`. Une ligue créée sans préciser de portée DOIT avoir `members`. Une
ligue antérieure à la fonctionnalité (portée absente) DOIT être traitée comme
`off`, sans backfill.

La portée DOIT se choisir à la création (`POST /leagues`), à l'édition tant
que la ligue n'est pas verrouillée (`PATCH /leagues/:id`), et à TOUT moment
par `PATCH /leagues/:id/predictions-scope`, ouvert au commissaire et aux
administrateurs, y compris sur une ligue verrouillée : aucun compteur
persisté n'en dépend. Une ligue invisible au demandeur DOIT répondre `404`,
une ligue visible dont il n'est ni commissaire ni administrateur `403`.

#### Scenario: Ligue neuve
- WHEN un coach crée une ligue sans préciser de portée
- THEN la ligue DOIT avoir la portée `members`

#### Scenario: Ligue antérieure
- WHEN une ligue n'a aucune portée enregistrée
- THEN personne NE DOIT pouvoir pronostiquer ses rencontres
- AND son commissaire DOIT se voir proposer d'activer les pronostics

#### Scenario: Ligue verrouillée
- WHEN le commissaire change la portée d'une ligue dont un match est joué
- THEN la portée DOIT être enregistrée malgré le verrou d'édition

### Requirement: Qui peut pronostiquer

Un pronostic DOIT être refusé à un lecteur non connecté, et sur une ligue de
portée `off`. En portée `members`, seuls le commissaire et les propriétaires
d'une équipe ACTIVE de la saison de la rencontre DOIVENT pouvoir pronostiquer ;
un coach retiré n'est plus membre. En portée `open`, tout compte connecté qui
VOIT la ligue DOIT pouvoir pronostiquer. La visibilité de la ligue DOIT être
vérifiée avant toute autre règle : une ligue privée DOIT rester introuvable
(`404`) pour qui n'en fait pas partie, quelle que soit la portée.

Un coach NE DOIT PAS pronostiquer une rencontre qui implique une de ses
équipes. Une rencontre de bracket dont un côté n'est pas encore connu
(`home === away`) NE DOIT PAS être pronostiquable.

La lecture DOIT exposer, pour chaque rencontre, le motif d'un refus (`ok`,
`anonymous`, `predictions-off`, `not-member`, `own-match`, `placeholder`,
`closed`), pour que l'écran l'explique.

#### Scenario: Sa propre rencontre
- WHEN un coach pronostique une rencontre de son équipe
- THEN la réponse DOIT être `403` et rien NE DOIT être écrit

#### Scenario: Spectateur d'une ligue réservée aux membres
- WHEN un compte qui n'a pas d'équipe dans la saison pronostique en portée `members`
- THEN la réponse DOIT être `403`

#### Scenario: Spectateur d'une ligue ouverte
- WHEN un compte qui voit la ligue pronostique en portée `open`
- THEN le pronostic DOIT être enregistré

#### Scenario: Ligue privée
- WHEN un tiers qui ne voit pas une ligue privée lit ou écrit un pronostic
- THEN la réponse DOIT être `404`, jamais `403`

### Requirement: Un pronostic, et ce qu'il rapporte

Un pronostic DOIT porter un vainqueur (`home`, `draw`, `away`) et PEUT porter
un score exact en TD. Le score DOIT être fourni pour les deux côtés ou pour
aucun, et DOIT être cohérent avec le vainqueur choisi. Un utilisateur DOIT
avoir au plus un pronostic par rencontre, modifiable et supprimable tant que
la rencontre est ouverte.

Un bon vainqueur DOIT rapporter 3 points, un bon nul aussi. Un score exact
DOIT rapporter 2 points de plus. Une rencontre forfaite, annulée ou perdue par
forfait en ligne NE DOIT rien rapporter et NE DOIT PAS entrer au classement.
Les points DOIVENT être recalculés à la lecture à partir du résultat
enregistré, jamais stockés.

#### Scenario: Score exact
- WHEN un coach a prédit `home` 2-0 et que la rencontre finit 2-0
- THEN son pronostic DOIT valoir 5 points

#### Scenario: Nul juste
- WHEN un coach a prédit `draw` et que la rencontre finit 1-1
- THEN son pronostic DOIT valoir 3 points

#### Scenario: Score incohérent
- WHEN un pronostic porte `away` avec un score 2-1
- THEN il DOIT être refusé (`400`)

#### Scenario: Forfait
- WHEN une rencontre pronostiquée se termine par un forfait
- THEN le pronostic NE DOIT ni rapporter de points ni compter dans le classement

### Requirement: La clôture d'une rencontre tient seule

Une rencontre DOIT être fermée aux pronostics dès que l'un de ces signaux est
présent : statut terminal (jouée, forfait, annulée), clôture enregistrée,
date prévue passée, journée de play-off non publiée, ligue archivée.

La clôture DOIT s'enregistrer une seule fois et NE DOIT jamais s'effacer, au
premier évènement consigné sur la feuille de match, à la première soumission
d'un coach, à l'enregistrement du résultat, ou par une clôture manuelle. Le
commissaire ou un administrateur DOIT pouvoir fermer une journée entière ;
les deux coachs d'une rencontre, le commissaire ou un administrateur DOIVENT
pouvoir fermer une rencontre. Une clôture manuelle NE DOIT s'enregistrer que
sur une rencontre OUVERTE : fermée pour une raison passagère (journée de
play-off non publiée, ligue archivée, date prévue passée), elle NE DOIT rien
écrire, sans quoi la clôture survivrait à sa raison. La date prévue DOIT être
relue à chaque lecture, pour qu'un report rouvre la rencontre tant qu'aucun
autre signal ne l'a fermée.

#### Scenario: Premier évènement
- WHEN un coach consigne le premier évènement de la feuille d'une rencontre
- THEN tout nouveau pronostic sur cette rencontre DOIT être refusé (`409`)

#### Scenario: Évènement retiré
- WHEN le seul évènement de la feuille est supprimé
- THEN la rencontre DOIT rester fermée

#### Scenario: Invalidation
- WHEN la feuille d'une rencontre jouée est invalidée
- THEN la rencontre DOIT rester fermée aux pronostics

#### Scenario: Report
- WHEN la date prévue d'une rencontre est passée puis reportée, sans autre signal
- THEN la rencontre DOIT être de nouveau ouverte jusqu'à la nouvelle date

#### Scenario: Clôture manuelle d'une rencontre de play-off non publiée
- WHEN le commissaire ferme une rencontre d'une journée de play-off pas encore publiée
- THEN rien NE DOIT être enregistré
- AND la rencontre DOIT s'ouvrir aux pronostics une fois le bracket publié

### Requirement: Rien des pronostics des autres avant la clôture

Tant qu'une rencontre est ouverte, la réponse de l'API NE DOIT contenir aucun
pronostic d'un autre utilisateur, ni leur répartition, ni leur nombre ; le
lecteur ne DOIT recevoir que le sien. Une fois la rencontre fermée, les
pronostics DOIVENT être servis avec le nom de leur auteur, leur répartition et,
une fois réglés, leur note. L'auteur d'un pronostic au profil privé qui n'est
ni coach de la saison ni commissaire DOIT apparaître comme anonyme, sauf pour
lui-même.

#### Scenario: Rencontre ouverte
- WHEN un coach lit les pronostics d'une rencontre encore ouverte
- THEN la réponse NE DOIT contenir que son propre pronostic

#### Scenario: Rencontre fermée
- WHEN la rencontre est fermée
- THEN tous les pronostics DOIVENT être servis, avec leur répartition

### Requirement: Le règlement suit le résultat, dans les deux sens

Le résultat d'une rencontre de ligue DOIT régler ses pronostics au moment où
il est enregistré, en copiant l'issue et le score réel sur chacun. La
reversion d'un résultat (invalidation d'une feuille, édition ex-post) DOIT les
remettre en attente. Un échec du règlement NE DOIT PAS faire échouer
l'enregistrement du résultat.

#### Scenario: Invalidation puis nouvelle saisie
- WHEN une feuille validée est invalidée puis validée avec un autre score
- THEN le classement des pronostics DOIT refléter le second score seulement

### Requirement: Deux classements, une implémentation

Le classement des pronostics d'une saison DOIT être dérivé des pronostics
réglés, jamais d'un compteur persisté. Il DOIT séparer deux groupes : Coachs
(propriétaires d'une équipe active de la saison) et Tribunes (tous les autres,
commissaire sans équipe, coach retiré et spectateurs compris). Le groupe DOIT
être relu à chaque lecture. Dans chaque groupe, l'ordre DOIT être : points,
puis scores exacts, puis bons résultats, puis nom.

#### Scenario: Commissaire sans équipe
- WHEN le commissaire, qui n'a pas d'équipe dans la saison, a pronostiqué
- THEN il DOIT figurer dans le groupe Tribunes

#### Scenario: Coach retiré
- WHEN un coach est retiré de la saison
- THEN ses points acquis DOIVENT figurer dans le groupe Tribunes

### Requirement: Oracle, succès et notification

Le palmarès d'une saison DOIT porter le titre d'Oracle : le premier du groupe
Coachs, ex æquo compris, avec ses points. Un échec de ce calcul NE DOIT PAS
empêcher le palmarès d'être servi ni persisté.

Les succès DOIVENT compter : un premier pronostic juste, dix pronostics
justes, un score exact, un titre d'Oracle et une première place du groupe
Tribunes, ces deux derniers sur des saisons clôturées.

Quand une journée se complète — par un résultat, un forfait ou la clôture de
la saison —, chaque utilisateur qui y a un pronostic réglé DOIT recevoir UNE
notification interne résumant ses points de la journée. Une journée DOIT être
notifiée au plus une fois, même invalidée puis complétée de nouveau.

#### Scenario: Oracle au palmarès
- WHEN une saison est clôturée
- THEN son palmarès DOIT nommer le meilleur coach au classement des pronostics

#### Scenario: Journée notifiée une fois
- WHEN une journée déjà notifiée se complète de nouveau après une invalidation
- THEN aucune nouvelle notification NE DOIT partir

#### Scenario: Journée complétée par la clôture de la saison
- WHEN le commissaire clôture une saison dont une journée n'est jouée qu'en partie
- THEN les pronostiqueurs des rencontres jouées de cette journée DOIVENT recevoir leur bilan
