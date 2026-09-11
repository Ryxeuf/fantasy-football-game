# league-standings

## ADDED Requirements

### Requirement: Sorties du classement et des classements individuels = sorties qui rapportent des PSP

Les colonnes `Sor+` / `Sor-` (`casualtiesFor` / `casualtiesAgainst`), le
différentiel de sorties, les points bonus « sorties infligées »
(`cas_inflicted_gte`) et les classements individuels « Cogneurs » et
« Tueurs » de la saison NE DOIVENT compter que les éliminations qui
rapportent les PSP d'Élimination à leur auteur, selon la définition unique
de la feuille de match (`eliminationEarnsSpp`, options par feuille :
compétences du coup d'envoi et Prières). Les agressions restent comptées
dans la colonne `Agr`, les sorties par le public dans `SP`.

#### Scenario: Validation d'une feuille avec agression
- WHEN une feuille validée porte 4 Éliminations sur Blocage et 1 agression avec blessure pour le domicile
- THEN le participant domicile DOIT recevoir `casualtiesFor + 4` (et non 5) et l'extérieur `casualtiesAgainst + 4`
- AND une règle bonus « 5 sorties infligées » NE DOIT PAS s'appliquer

#### Scenario: Cogneurs de la saison
- WHEN un joueur a 1 Élimination sur Blocage, un autre 1 agression avec blessure sans Frénésie d'Agression, un troisième 1 Élimination sur Action Spéciale sans Innovateur Violent
- THEN seul le premier DOIT figurer parmi les cogneurs, avec 1 sortie
- AND le deuxième DOIT figurer parmi les agresseurs

#### Scenario: Exceptions lues par feuille
- WHEN une feuille porte la Prière « Frénésie d'Agression » pour l'extérieur et un gel où le n°3 domicile a « Innovateur Violent »
- THEN l'agression avec blessure de l'extérieur et l'Action Spéciale du n°3 domicile DOIVENT compter comme sorties dans les cogneurs de la saison
- AND la même agression sur une autre feuille sans la prière NE DOIT PAS compter
