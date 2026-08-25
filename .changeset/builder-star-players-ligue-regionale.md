---
"@bb/server": patch
"@bb/web": patch
---

Correctifs du builder d'équipe et des Star Players.

- **Paramètres d'URL du builder.** Arriver sur `/me/teams/new?roster=goblin&ruleset=season_3` depuis la fiche d'un roster laissait le formulaire sur ses valeurs par défaut. Les paramètres étaient lus dans les initialiseurs `useState` : sur un chargement complet, le HTML est rendu côté serveur sans `window`, et React 18 ne recorrige pas la `value` d'un `<select>` à l'hydratation. Ils sont désormais appliqués dans un effet de montage (`builder-url-params.ts`, lecture pure et validée).
- **Star Players et budget.** Recruter un Star Player ne bougeait plus le « Budget » du bandeau de résumé : son coût est maintenant déduit du budget restant, les boutons « + » des postes en tiennent compte, et une métrique « ⭐ Stars » apparaît quand la sélection coûte.
- **Star Players et Ligue régionale.** `GET /star-players/available/:roster` servait l'union de toutes les Ligues du roster : un coach Halfling en Ligue Sylvestre se voyait proposer Cindy Piewhistle, et la création échouait ensuite. La route accepte `?regionalLeague=` et passe par `resolveTeamRegionalRules` (base : les Ligues déclarées par le roster) ; le sélecteur transmet la Ligue et purge une recrue devenue indisponible.
- **Choix de Ligue bloquant.** Pour un roster à plusieurs Ligues, la création est désactivée tant qu'aucune n'est retenue, avec la raison affichée dans le bandeau ; le sélecteur marque le choix requis. Un roster mono-ligue se la voit toujours attribuer d'office. Le sélecteur de Star Players n'apparaît qu'une fois la Ligue tranchée.
- **Star Players sur la fiche d'équipe.** Ils n'apparaissaient nulle part (ce ne sont pas des `TeamPlayer`) : nouveau panneau sous la composition (nom, coût, caractéristiques, compétences, règle spéciale, total) et ligne « ⭐ Coût des Star Players » dans « Staff de l'équipe ».
- **Édition avancée.** La case à cocher est remplacée par l'interrupteur déjà utilisé pour l'apothicaire.
