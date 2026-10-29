# league-match-sheet

## MODIFIED Requirements

### Requirement: Une sortie est une élimination qui rapporte des PSP

Le résumé d'une feuille de match (`casualtiesHome/Away` par équipe,
`casualtiesInflicted` par joueur) NE DOIT compter que les éliminations qui
rapportent les PSP d'Élimination à leur auteur, selon une définition UNIQUE
(`eliminationEarnsSpp`) :

- une Élimination sur Blocage (blitz compris) compte toujours ;
- une Élimination sur Action Spéciale compte si son auteur a « Innovateur
  Violent » au coup d'envoi ;
- une Élimination en atterrissant sur un adversaire compte si le joueur
  lancé a « Vol Fatal » au coup d'envoi ;
- une Élimination lors d'une Agression compte si le côté de l'auteur a
  obtenu la Prière à Nuffle 13 « Frénésie d'Agression » ;
- une sortie par le public, une esquive ratée, une chute ou une
  temporisation ne comptent jamais.

Une élimination ANNULÉE par un Apothicaire ou par la Régénération reste une
élimination (`eliminationOccurred`) : une Élimination sur Blocage ou sur
Action Spéciale l'est par son type, gravité saisie ou non ; les autres types
le sont quand la saisie porte une gravité ou l'issue « Aucune séquelle »
(`healed`). Une élimination soignée NE DOIT créer aucune blessure (ni absence
au match suivant, ni jet de Haine, ni mort).

Les compétences DOIVENT être lues dans le gel de la feuille (« version du
match »), les Prières dans les colonnes d'avant-match de la feuille. Une
agression DOIT rester comptée dans les agressions et sa blessure consignée,
que la sortie compte ou non. Les sorties d'équipe DOIVENT être la somme des
sorties créditées aux joueurs, à l'exception d'une Élimination sur Blocage
saisie sans acteur, qui compte pour l'équipe seule.

#### Scenario: Agression qui blesse, sans prière
- WHEN une feuille porte 4 Éliminations sur Blocage et 1 agression avec blessure pour l'équipe domicile
- THEN `casualtiesHome` DOIT valoir 4
- AND l'agresseur DOIT avoir `aggressions = 1` et `casualtiesInflicted = 0`
- AND la victime de l'agression DOIT figurer parmi les blessés

#### Scenario: Agression sous Frénésie d'Agression
- WHEN l'équipe domicile a obtenu la Prière 13 et qu'un de ses joueurs blesse un adversaire lors d'une Agression
- THEN cette agression DOIT compter comme sortie de l'équipe domicile et créditer `casualtiesInflicted` à son auteur
- AND une agression de l'équipe extérieure NE DOIT PAS compter (la prière ne bénit que son côté)

#### Scenario: Action Spéciale et atterrissage sans la compétence
- WHEN un joueur sans « Innovateur Violent » élimine un adversaire par une Action Spéciale, et qu'un joueur lancé sans « Vol Fatal » en élimine un autre en atterrissant
- THEN aucune des deux éliminations NE DOIT compter dans les sorties de l'équipe
- AND les deux victimes DOIVENT figurer parmi les blessés

#### Scenario: Élimination soignée par l'Apothicaire
- WHEN une Élimination sur Blocage est saisie sans gravité, ou avec l'issue « Aucune séquelle »
- THEN elle DOIT compter dans les sorties de l'équipe et créditer `casualtiesInflicted` (donc ses PSP) à son auteur
- AND sa victime NE DOIT PAS figurer parmi les blessés

#### Scenario: Agression sans effet
- WHEN une agression est saisie sans gravité ni issue « Aucune séquelle », sous Frénésie d'Agression
- THEN elle NE DOIT PAS compter comme sortie

#### Scenario: Même résultat à la lecture et à la validation
- WHEN une feuille est lue puis validée
- THEN les sorties et les PSP affichés DOIVENT être exactement ceux persistés par la validation (mêmes options de summarizer)

### Requirement: Resynchronisation des sorties d'une feuille validée

Le serveur DOIT permettre de resynchroniser les compteurs persistés d'une
feuille de LIGUE déjà validée avec la définition courante d'une sortie, sans
rejouer la séquence de fin de match : sorties pour / contre des deux
participants, `totalCasualties` et PSP de chaque joueur (au barème du côté),
points bonus du pairing (règles de la ligue ré-évaluées, bonus commissaire
conservé) et snapshot `offlineResultInput`. La même passe DOIT rattraper les
Lancers Sécurisés (1 PSP chacun au lanceur, absents des snapshots antérieurs)
et créditer un match joué au joueur qui n'avait aucune ligne de stats à la
validation. L'opération DOIT être idempotente, journalisée dans le journal
des deux équipes, et DOIT ignorer les rencontres de coupe, les feuilles non
validées et les saisons clôturées. Les feuilles validées sous une version
antérieure de la règle (`casualtyRuleVersion < 2`) DOIVENT être rattrapées à
la lecture du classement de leur saison.

#### Scenario: Feuille validée sous l'ancienne règle
- WHEN une feuille validée persiste 5 sorties domicile dont 1 agression, et que sa relecture n'en compte que 4
- THEN la resynchronisation DOIT retirer 1 sortie pour au domicile et 1 sortie contre à l'extérieur
- AND retirer 1 sortie de carrière et 2 PSP (3 en Bagarreurs Brutaux) à l'agresseur
- AND réécrire le snapshot avec 4 sorties, de sorte qu'une invalidation ultérieure reprenne 4

#### Scenario: Élimination soignée validée sous la règle v1
- WHEN une feuille validée sous la règle v1 porte une Élimination sur Blocage sans gravité, qui n'avait rien crédité
- THEN la resynchronisation DOIT ajouter la sortie au domicile et 2 PSP à son auteur

#### Scenario: Lancers Sécurisés jamais crédités
- WHEN une feuille validée porte deux Lancers de coéquipier d'un même lanceur, absents du snapshot
- THEN la resynchronisation DOIT lui créditer 2 PSP, sans toucher aux sorties
- AND réécrire le snapshot pour qu'une invalidation reprenne ces 2 PSP

#### Scenario: Feuille déjà à jour
- WHEN les compteurs persistés correspondent à la relecture
- THEN la resynchronisation NE DOIT rien écrire

#### Scenario: Simulation
- WHEN la resynchronisation est lancée sans `apply`
- THEN le plan DOIT être calculé et rendu sans aucune écriture

## ADDED Requirements

### Requirement: Lancer Sécurisé

Un évènement « Lancer de coéquipier réussi » (`team_throw`) DOIT créditer
1 PSP à son acteur, le LANCEUR, sans modificateur d'équipe. L'atterrissage du
joueur lancé reste un évènement distinct (`ttm_landing`, 1 PSP au joueur
lancé). Le PSP du lanceur DOIT être affiché sur la feuille, persisté à la
validation, repris à l'invalidation et compté dans les PSP de saison.

#### Scenario: Lancer et atterrissage
- WHEN un joueur réussit un Lancer de Coéquipier et que le joueur lancé atterrit sur ses pieds
- THEN le lanceur DOIT gagner 1 PSP et le joueur lancé 1 PSP

#### Scenario: Lancer seul
- WHEN seul le lancer est saisi
- THEN le lanceur DOIT gagner 1 PSP et personne d'autre

### Requirement: Garde d'ouverture d'une feuille de ligue

L'ouverture d'une feuille de LIGUE DOIT être refusée (`409`,
`code: "previous_match_pending"`) tant qu'une rencontre d'une journée
antérieure de la même saison, impliquant l'une des deux équipes, n'est ni
jouée, ni forfait, ni annulée. La réponse DOIT nommer ces rencontres
(`details.blocking`) et dire si le viewer peut forcer (`details.canForce`).
Le commissaire (ou un administrateur) DOIT pouvoir ouvrir la feuille malgré
tout (`force: true`) ; un coach NE DOIT PAS le pouvoir. Une feuille déjà
ouverte se relit sans garde ; une feuille de coupe n'est pas concernée.

#### Scenario: Journée précédente non validée
- WHEN un coach ouvre la feuille de la journée 2 alors que la journée 1 de son équipe n'est pas validée
- THEN la réponse DOIT être `409` et nommer la rencontre de la journée 1
- AND la feuille NE DOIT PAS être créée

#### Scenario: Journée reportée
- WHEN le commissaire ouvre la même feuille avec `force: true`
- THEN la feuille DOIT être créée

#### Scenario: Journée précédente close
- WHEN les rencontres de la journée 1 des deux équipes sont validées
- THEN la feuille de la journée 2 DOIT s'ouvrir normalement

### Requirement: Fraîcheur et mise à jour du gel

La lecture d'une feuille de LIGUE ni validée ni invalidée DOIT servir
`snapshotFreshness` : pour chaque côté, la dernière autre feuille de ligue de
l'équipe validée ou invalidée APRÈS le gel (journée, équipes, date), et
`refreshable` (aucune soumission). Un coach du match ou le commissaire DOIT
pouvoir mettre la feuille à jour (`POST /leagues/pairings/:id/sheet/refresh`)
tant qu'elle est en brouillon : le gel des deux équipes est refait depuis
leur état courant, sans préserver l'ancien, en gardant l'avant-match, les
évènements et les choix de postes des journaliers. La mise à jour DOIT être
refusée (`409`) si la feuille a été soumise, et si la saisie cite un joueur
que le nouveau gel ne connaît plus (liste à l'appui). La feuille DOIT
afficher l'alerte, la rencontre en cause et le bouton.

#### Scenario: Feuille ouverte avant la validation de la journée précédente
- WHEN la feuille de la journée 2 est ouverte, puis la journée 1 d'une des deux équipes validée
- THEN la lecture DOIT signaler cette rencontre pour le côté concerné
- AND la trésorerie figée NE DOIT PAS encore refléter les gains de la journée 1

#### Scenario: Mise à jour
- WHEN un coach met la feuille à jour
- THEN la trésorerie figée DOIT refléter les gains de la journée 1
- AND la feuille NE DOIT plus être signalée périmée

#### Scenario: Feuille déjà soumise
- WHEN un coach a soumis la feuille
- THEN la mise à jour DOIT être refusée en expliquant de retirer les soumissions

#### Scenario: Joueur disparu du roster
- WHEN un évènement cite un joueur mort lors de la journée précédente
- THEN la mise à jour DOIT être refusée et nommer ce joueur
