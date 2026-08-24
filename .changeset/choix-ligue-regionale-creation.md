---
"@bb/game-engine": minor
"@bb/server": minor
"@bb/web": minor
---

Choix de la Ligue régionale à la création d'une équipe.

Le moteur faisait jusqu'ici l'union de toutes les règles régionales d'un roster : une équipe Nains pouvait recruter les Star Players de la Classique du Vieux Monde ET de la Super-ligue du Bord du Monde, et acheter les Coups de Pouce des deux. Les règles officielles veulent qu'une équipe appartienne à UNE Ligue, choisie en construisant sa Liste d'Équipe.

- Moteur : `getRegionalLeagueOptions` (les Ligues entre lesquelles trancher, alignements « Favori de… » séparés) et `resolveTeamRegionalRules` (règles effectives depuis le choix). Les Nordiques ont désormais le choix Classique du Vieux Monde / Clash du Chaos, et c'est le Clash du Chaos qui apporte Favori de Khorne.
- Schéma : `Team.regionalLeague` (migration additive, `NULL` pour les équipes existantes → union historique conservée, aucun recrutement retiré rétroactivement).
- Serveur : les deux flux de création acceptent `regionalLeague`, l'imposent d'office pour un roster mono-ligue et refusent en 422 un roster multi-ligues sans choix (Nains du Chaos, Nains, Gnomes, Gobelins, Halflings, Nordiques, Ogres, Elfes Sylvains en Saison 3). La Ligue retenue pilote ensuite la disponibilité des Star Players (listing, recrutement, feuille de match) et des Coups de Pouce.
- Règlements de tournoi : nouveau `regionalLeagueChoice` — un pack qui neutralise l'axe régional n'enregistre aucune Ligue.
- API publique `/api/rosters` : `regionalLeagueOptions` (avec les alignements apportés) et `regionalLeagueChoiceRequired`, sur la liste comme sur le détail.
- Clients : sélecteur dans le builder web, dans l'assistant « 60 secondes » (dernière étape, seulement si le roster a le choix) et dans l'écran de création mobile ; la fiche d'équipe met en avant la Ligue retenue et grise les autres.
