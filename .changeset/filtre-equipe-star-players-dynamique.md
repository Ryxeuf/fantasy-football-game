---
"@bb/game-engine": patch
"@bb/web": patch
---

Filtre « Équipe » des Star Players : liste complète et dépendante de la saison.

**Le manque.** Le sélecteur d'équipe de `/star-players` proposait cinq slugs codés en dur dans le composant — Skavens, Elfes sylvains, Nains, Orques, Humains. Les vingt-six autres équipes du catalogue étaient donc infiltrables : impossible de demander « qui joue pour les Nordiques ». Et la liste ne bougeait pas quand on changeait la saison juste à côté, alors que le parc d'équipes, lui, change d'une édition à l'autre (les Bretonniens n'existent qu'en saison 3).

**Les options viennent maintenant de `GET /api/rosters`**, avec la saison et la langue sélectionnées, et sont rechargées à chaque changement de l'une ou de l'autre : c'est la même source que les pages `/teams`, donc une édition admin d'un roster se voit ici aussi. Si l'API est indisponible, le filtre retombe sur le catalogue du moteur pour l'édition demandée — un filtre non localisé reste préférable à un filtre incomplet.

**Le filtrage lui-même suit la saison.** Il s'appuyait sur `TEAM_REGIONAL_RULES`, figé sur la saison 2 : les Ligues 2025 (`woodland_league`, `chaos_clash`, `favoured_of_khorne`…) n'y étaient pas, et un `hirableBy` contenant un slug de roster brut — la forme que l'API remonte quand l'embauche est déclarée équipe par équipe en base — n'était jamais reconnu. Le prédicat vit désormais dans le moteur (`isStarPlayerHirableByRoster`, pur et testé, équivalence vérifiée avec l'index inverse sur les deux éditions), le même référentiel que la rubrique « Joue pour » des fiches : les deux ne peuvent plus diverger.

Enfin, une équipe sélectionnée qui n'existe pas dans la saison choisie retombe sur « Toutes les équipes » au lieu de vider la liste sans explication.
