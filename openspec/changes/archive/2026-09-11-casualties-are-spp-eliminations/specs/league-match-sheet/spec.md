# league-match-sheet

## ADDED Requirements

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

#### Scenario: Même résultat à la lecture et à la validation
- WHEN une feuille est lue puis validée
- THEN les sorties et les PSP affichés DOIVENT être exactement ceux persistés par la validation (mêmes options de summarizer)

### Requirement: Resynchronisation des sorties d'une feuille validée

Le serveur DOIT permettre de resynchroniser les compteurs persistés d'une
feuille de LIGUE déjà validée avec la définition courante d'une sortie, sans
rejouer la séquence de fin de match : sorties pour / contre des deux
participants, `totalCasualties` et PSP de chaque joueur (au barème du côté),
points bonus du pairing (règles de la ligue ré-évaluées, bonus commissaire
conservé) et snapshot `offlineResultInput`. L'opération DOIT être
idempotente, journalisée dans le journal des deux équipes, et DOIT ignorer
les rencontres de coupe, les feuilles non validées et les saisons clôturées.

#### Scenario: Feuille validée sous l'ancienne règle
- WHEN une feuille validée persiste 5 sorties domicile dont 1 agression, et que sa relecture n'en compte que 4
- THEN la resynchronisation DOIT retirer 1 sortie pour au domicile et 1 sortie contre à l'extérieur
- AND retirer 1 sortie de carrière et 2 PSP (3 en Bagarreurs Brutaux) à l'agresseur
- AND réécrire le snapshot avec 4 sorties, de sorte qu'une invalidation ultérieure reprenne 4

#### Scenario: Feuille déjà à jour
- WHEN les compteurs persistés correspondent à la relecture
- THEN la resynchronisation NE DOIT rien écrire

#### Scenario: Simulation
- WHEN la resynchronisation est lancée sans `apply`
- THEN le plan DOIT être calculé et rendu sans aucune écriture
