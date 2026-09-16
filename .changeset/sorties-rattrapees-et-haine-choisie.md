---
"@bb/server": minor
"@bb/web": patch
"@bb/game-engine": patch
---

Les sorties déjà validées se rattrapent toutes seules — et le Mot-clé de Haine (X) se choisit.

**« L'appli compte 5 sorties alors que c'est 4 + 1 agression. »** La règle était pourtant déjà la bonne : une sortie est une élimination qui rapporte des PSP. Mais un correctif de CALCUL ne corrige pas un compteur PERSISTÉ — les colonnes Sor+/Sor- du classement, les points bonus « sorties infligées » du pairing, les sorties de carrière et les PSP des joueurs sont écrits à la validation de la feuille. La feuille, relue avec la règle courante, annonçait 4 ; le classement gardait le 5 d'alors. Le rattrapage existait mais n'était branché que sur un script d'opérateur, donc en pratique jamais joué.

**Il se déclenche désormais tout seul**, à la première lecture du classement de la saison : pas de cron, pas d'intervention, la resynchronisation existante (idempotente, journalisée dans le journal d'équipe) est rejouée sur les feuilles concernées puis celles-ci sont marquées. Le marqueur est la VERSION de la règle sous laquelle la feuille a été validée, ce qui permet de recommencer le jour où la qualification d'une sortie changera encore. Après le passage, la lecture d'un classement ne coûte plus rien, et un rattrapage en échec n'empêche jamais d'afficher le classement.

**Deux compteurs d'éliminations restants sont alignés.** Le « sac de frappe » exige maintenant une blessure effectivement consignée — une agression sans effet classait quand même sa cible — et compte l'atterrissage d'un adversaire qui plaque un joueur. Le libellé du « Meilleur castagneur » décrit la règle en vigueur au lieu de l'ancienne (« sur blocage et autres »).

**Haine (X) : le Mot-clé haï se choisit.** Le trait retenait d'office le premier Mot-clé de celui qui avait mis le joueur sur la touche. Or un adversaire en porte souvent plusieurs — un Zombie est *Humain*, *Mort-Vivant* ET *Zombie* — et haïr l'une ou l'autre lignée ne recouvre pas les mêmes adversaires au reste de la saison. Le panneau de fin de match propose désormais, pour chaque joueur candidat au jet, les Mots-clés de celui qui l'a blessé ; le coach du blessé (ou le commissaire) en retient un. Le choix est stocké, le candidat reste dérivé des évènements : corriger l'auteur d'une sortie change les Mots-clés proposés, un choix devenu ineligible retombe silencieusement sur le premier, et une feuille sans choix se valide exactement comme avant. Les Mots-clés de poste (Blitzer, Trois-quart…) restent exclus.
