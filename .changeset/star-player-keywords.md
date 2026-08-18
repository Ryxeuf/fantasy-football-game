---
"@bb/game-engine": minor
"@bb/server": minor
"@bb/web": minor
---

Les Star Players portent désormais des mots-clés (lignée + type de joueur), comme les positionnels : nouvelle table `STAR_PLAYER_KEYWORDS` dans le game-engine (68 stars, même vocabulaire FR que `KEYWORDS_SEASON3`), colonne `StarPlayer.keywords` peuplée au seed, champs `keywords`/`keywordsEn` exposés par les routes `/star-players*` et les endpoints Star Players d'une équipe (avec repli sur le game-engine tant que la base n'est pas re-seedée). Côté web : étiquettes sur la carte de listing, la fiche détail et le sélecteur de recrutement, filtre par mots-clés (ET logique) sur `/star-players`, mots-clés dans le JSON-LD et les métadonnées SEO de la fiche, et champ « Mots-clés » dans les formulaires admin.
