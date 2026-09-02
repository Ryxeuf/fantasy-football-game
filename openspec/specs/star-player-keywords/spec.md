# star-player-keywords

## Purpose

Mots-clés officiels (lignée + type de joueur) des Star
Players, de la source game-engine jusqu'à l'affichage web, en parité avec
les mots-clés de positionnels.

## Requirements

### Requirement: Table de mots-clés couvrant tous les Star Players
Le game-engine DOIT exposer un mot-clé CSV pour **chaque** Star Player de
chaque ruleset, dans le même vocabulaire FR que les mots-clés de position.
Le premier token DOIT être une lignée, le dernier un type de joueur, et
chaque token DOIT être traduisible en anglais.

#### Scenario: Couverture complète
- WHEN on énumère les Star Players de `season_2` et de `season_3`
- THEN chacun DOIT avoir une entrée dans `STAR_PLAYER_KEYWORDS`
- AND `StarPlayerDefinition.keywords` DOIT porter cette valeur

#### Scenario: Vocabulaire fermé
- WHEN un mot-clé est ajouté ou corrigé
- THEN ses tokens DOIVENT appartenir aux listes de lignées / types exportées
- AND le test unitaire DOIT échouer si un token inconnu est introduit

### Requirement: Persistance et exposition API
La colonne `StarPlayer.keywords` DOIT stocker le CSV FR, et l'API DOIT
servir `keywords` (FR) et `keywordsEn` (traduit) sur les routes Star
Players.

#### Scenario: Base à jour
- WHEN la colonne `keywords` est renseignée
- THEN l'API DOIT servir sa valeur telle quelle en `keywords`
- AND `keywordsEn` DOIT en être la traduction token par token

#### Scenario: Base pas encore re-seedée
- WHEN la colonne `keywords` est `NULL` pour un slug connu du game-engine
- THEN l'API DOIT servir le mot-clé issu du game-engine
- AND servir `null` si le slug est inconnu des deux sources

### Requirement: Affichage et filtre côté web
Les mots-clés DOIVENT être affichés en étiquettes sur les surfaces Star
Player, dans la langue active (repli FR), et `/star-players` DOIT offrir un
filtre par mots-clés.

#### Scenario: Étiquettes bilingues
- WHEN un visiteur consulte la liste, la fiche détail ou le sélecteur de recrutement
- THEN les mots-clés DOIVENT s'afficher en étiquettes
- AND passer en anglais quand la langue active est `en`

#### Scenario: Filtre ET logique
- WHEN plusieurs mots-clés sont sélectionnés sur `/star-players`
- THEN seuls les Star Players portant **tous** ces mots-clés DOIVENT rester listés
- AND la comparaison DOIT être insensible à la casse, aux accents et aux tirets
