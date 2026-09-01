---
"@bb/server": minor
"@bb/web": minor
---

Édition d'un roster : rendre les compétences corrigeables, et cesser de proposer ce que le règlement impose.

Quatre défauts remontés sur `/me/teams/:id/edit`, tous sur une équipe construite sous un règlement de tournoi qui accorde des PSP supplémentaires.

**Impossible de supprimer une compétence achetée au build.** Deux causes se cumulaient. D'abord, `removePlayerAdvancement` et `setStartingPspPool` appelaient `isTeamRosterFrozen` EN DIRECT, là où la page lit le gel via `isRosterFrozenFor` — qui l'ignore pour un admin. La console ouvrait donc la fiche, annoncée déverrouillée, puis rendait 409 au premier clic sur la croix d'annulation. Ensuite, le gel lui-même était trop précoce : il tombe dès l'INSCRIPTION à une ligue, alors qu'un commissaire monte sa saison des semaines avant le premier match. Nouveau prédicat `isTeamBuildLocked`, distinct de `isTeamRosterFrozen` et volontairement plus tardif : il ne se déclenche qu'à l'ENTRÉE EN JEU — feuille de match ouverte sur un appariement de l'équipe, appariement sorti de l'état « prévu », match en ligne ou local, inscription en coupe (dont le `rosterSnapshot` est figé dès l'inscription). Il gouverne les trois endpoints d'édition avancée ET le financement par le pool de `PUT /team/:id/players/:playerId/skills`, sans quoi un coach pouvait annuler un achat sans pouvoir en refaire un. La composition, elle, reste protégée par l'ancien gel : les deux ne servent pas la même règle.

**La page redirigeait avant même d'être utile.** Elle redirigeait sur `frozen`, donc dès l'inscription. Elle redirige désormais sur `buildLocked` (servi par `/team/:id/available-positions`) et, quand seule la composition est figée, passe effectif, staff, Star Players, budget et nom en lecture seule avec un bandeau qui dit ce qui reste modifiable — plutôt que d'offrir des actions que le serveur refuserait. La règle vit dans `edit-access.ts`, pur et testé.

**L'interrupteur « Édition avancée » ne faisait rien.** Le corps du panneau s'affichait dès que `state.pool > 0` : l'interrupteur ne pouvait que le rouvrir. Il replie réellement.

**Pool de PSP et budget d'or imposés restaient saisissables.** Sous un règlement de tournoi, `TournamentRosterRules` publie `goldBudget` ET `sppBudget` : les offrir à la saisie revenait à s'attribuer des PSP hors barème d'un tournoi officiel. `GET /team/:id/psp-pool` annonce désormais qui impose la valeur (`lockedBy` / `budgetLockedBy` : coupe > règlement), `setStartingPspPool` refuse, et le panneau affiche un encart 🔒 nommant la source. Le budget, jusqu'ici non éditable après création, l'est via `PUT /team/:id/initial-budget` sous exactement les mêmes serrures : bornes du builder, refus de descendre sous l'or déjà engagé, resynchronisation de la trésorerie du brouillon.

S'y ajoute le repli du bloc Star Players sur la fiche d'édition — le catalogue fait plusieurs écrans et s'intercale entre le résumé budgétaire et l'effectif. Le choix est mémorisé par équipe.
