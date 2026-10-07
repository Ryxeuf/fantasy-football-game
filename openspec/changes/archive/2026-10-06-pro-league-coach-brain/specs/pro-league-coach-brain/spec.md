# pro-league-coach-brain

## ADDED Requirements

### Requirement: Un plan de drive par équipe, qui colle

Le full driver DOIT choisir pour chaque équipe un plan de drive (stratégie,
formation, tempo, plancher de risque, politique de relance et d'agression)
au début d'un drive, par tirage pondéré par le profil tactique, et NE DOIT
le ré-évaluer que sur évènement : changement de possession, de mi-temps,
passage en fin de mi-temps, bascule du score.

#### Scenario: Même plan pendant le drive
- WHEN une équipe conserve le ballon pendant quatre tours sans évènement
- THEN le plan de drive DOIT rester le même pendant ces quatre tours

#### Scenario: Ballon libre dans sa moitié
- WHEN le ballon est au sol dans la moitié de l'équipe active
- THEN le contexte DOIT la considérer en attaque (plan offensif)

### Requirement: Des activations entières scorées en espérance

Le coach DOIT générer pour chaque joueur activable des activations entières
(chemin case par case et action finale) avec la probabilité de réussite de
la séquence, et les scorer `P × gain − (1 − P) × coût du turnover`. Les
probabilités DOIVENT être calculées avec les cibles, modificateurs et
soutiens du moteur. Un touchdown DOIT valoir 1000 de plus que rester.

#### Scenario: Chemin le plus sûr
- WHEN une case est atteignable en contournant une zone de tacle sans esquive
- THEN le chemin retenu DOIT être celui sans esquive, même s'il est plus long

#### Scenario: Blocage à un dé sans Blocage
- WHEN un blocage se jouerait à un dé sans la compétence Blocage
- THEN le candidat DOIT être marqué comme pari et classé en fin de tour

### Requirement: Ordre canonique d'un tour

Le coach DOIT jouer les actions sans dés avant les blocages à deux dés, puis
les blitz, puis les actions de ballon, puis les esquives ; une action
risquée NE DOIT passer avant une action sûre que si son espérance est très
supérieure.

#### Scenario: Déplacements sûrs d'abord
- WHEN un déplacement sans jet et un blocage à deux dés ont la même espérance
- THEN le déplacement DOIT être joué en premier

### Requirement: Le porteur est escorté là où il va

Les coéquipiers DOIVENT ancrer leur escorte sur la case visée par le
porteur ce tour-ci, les coins de cage valant plus que la case juste devant
lui, et les blocages sur ses marqueurs DOIVENT hériter d'une part de ce que
son déplacement rapporterait.

#### Scenario: Porteur marqué
- WHEN le porteur est marqué par un adversaire et qu'un coéquipier peut le bloquer à deux dés
- THEN ce blocage DOIT être joué avant l'esquive du porteur

### Requirement: Le bench CI mesure le driver de production

`sim:bench:ci` DOIT jouer ses duels avec le full driver et comparer à une
baseline déclarant `driverKind: 'full'`.

#### Scenario: Baseline
- WHEN la baseline déclare vingt matchs par duel en full driver
- THEN `sim:bench:ci` DOIT les rejouer à l'identique et passer

### Requirement: Un ballon libre ne repose jamais sous un joueur

Le moteur DOIT faire rebondir un ballon posé sur la case d'un joueur au sol,
faire tenter la réception à tout joueur debout sur la case d'arrivée, et
remettre en jeu par le public un ballon sorti du terrain.

#### Scenario: Porteur renversé
- WHEN un porteur est mis au sol par un blocage
- THEN le ballon DOIT se trouver sur une case libre ou dans les mains d'un joueur debout
