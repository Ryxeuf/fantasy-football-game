# player-cards (delta)

Capability : export de cartes joueur individuelles (PNG façon carte à
collectionner) pour les Star Players et les joueurs d'équipe.

## ADDED Requirements

### Requirement: Rendu PNG imprimable et cohérent
Le site DOIT produire pour un joueur une carte PNG 750×1050 px (63,5×88,9 mm
à 300 dpi) portant : nom, type (poste ou STAR PLAYER), colonne MA/ST/AG/PA/AV
en notation officielle (AG/PA/AV suffixés « + », PA absent rendu « - »),
compétences résolues dans la langue demandée, rubrique « Joue pour », coût en
po formaté, et l'identité visuelle Nuffle Arena aux couleurs canoniques du
roster. La carte NE DOIT PAS embarquer d'artwork Games Workshop.

#### Scenario: Carte d'un joueur d'équipe
- WHEN un coach exporte la carte d'un joueur de sa fiche d'équipe
- THEN le PNG affiche numéro, poste, stats, compétences FR/EN, équipe +
  roster, valeur en po et les mini-stats de carrière (matchs, TD, sorties, PSP)
- AND l'emblème est le logo programmatique du roster avec son monogramme

#### Scenario: Carte d'un Star Player
- WHEN un visiteur ouvre `/star-players/[slug]/card`
- THEN le PNG affiche coût (prix de la paire pour un duo obligatoire),
  règle spéciale tronquée proprement, « Joue pour » compact (sentinelle
  `all` → libellé unique, longues listes coupées en « + N autres équipes »)
- AND un ruban MEGA-STAR apparaît pour les méga-stars

#### Scenario: Statuts particuliers
- WHEN le joueur exporté est mort ou licencié
- THEN la carte porte un ruban DÉCÉDÉ ou LICENCIÉ dans la langue demandée

### Requirement: Renderer générique sûr
`GET /api/player-card` DOIT rendre uniquement un payload `?d=` décodé et
validé par `decodeCardPayload` (bornes par champ, caractères de contrôle
neutralisés, cap global de 8 Ko) et répondre 400 sans rien dessiner pour
tout payload absent, malformé ou hors bornes.

#### Scenario: Payload valide
- WHEN `?d=` contient un `PlayerCardData` encodé en base64url dans les bornes
- THEN la route répond un PNG avec `Cache-Control: public`
- AND `?download=1` ajoute `Content-Disposition: attachment` avec un nom de
  fichier translittéré (`carte-<nom>.png` / `card-<nom>.png`)

#### Scenario: Payload invalide
- WHEN `?d=` est absent, illisible, trop long ou contient un champ hors bornes
- THEN la route répond 400 avec une erreur JSON, sans invoquer satori

### Requirement: Accès depuis les fiches existantes
La fiche Star Player DOIT proposer « Voir la carte » et « Télécharger la
carte PNG » dans la langue active, et la fiche « Mes équipes » DOIT proposer
l'export par joueur (tableau desktop et vue mobile) sans requête
supplémentaire au clic (payload construit depuis les données déjà chargées).

#### Scenario: Fiche star
- WHEN un visiteur consulte `/star-players/[slug]`
- THEN deux liens `star-card-preview` / `star-card-download` pointent vers
  `/star-players/[slug]/card` avec `lang` = langue active

#### Scenario: Fiche d'équipe
- WHEN un coach consulte sa fiche d'équipe
- THEN chaque joueur expose des boutons carte (`player-card-*`) en desktop
  et mobile, y compris pour les joueurs morts/licenciés (carte souvenir)
