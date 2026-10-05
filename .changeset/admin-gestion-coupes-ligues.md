---
"@bb/server": minor
"@bb/web": minor
---

Console admin : gestion complète des coupes et des ligues, visibilité comprise.

**Le manque.** Un administrateur ne pouvait pas modifier une ligue sans en être le commissaire (`PATCH /leagues/:id` refuse tout autre compte), ni changer sa visibilité. Côté coupes, l'API d'édition et de suppression acceptait déjà les admins mais la console ne s'en servait pas, et la liste chargeait toutes les coupes avec tous leurs participants pour filtrer côté navigateur.

**Ligues.** `GET /admin/leagues/:id` sert la fiche complète (saisons et nombre d'inscrits, verrou du barème, email du commissaire) et `PATCH /admin/leagues/:id` l'édite : nom, description, capacité, visibilité et barème. La visibilité, règle de lecture, se change à tout moment ; le barème reste figé (409) dès qu'un match a été scoré, comme pour le commissaire. La console gagne un filtre et une bascule de visibilité, la suppression et une fiche `/admin/leagues/[id]` (édition, statut forcé, saisons, archivage, suppression confirmée en tapant le nom).

**Coupes.** `GET /admin/cups` liste les coupes avec des filtres serveur (statut, visibilité, recherche sur le nom, le créateur ou son email), une pagination et des compteurs globaux. La console affiche un tableau sur desktop et des cartes sur mobile, avec la bascule de visibilité et la suppression. La fiche `/admin/cups/[id]` édite le nom, la description, le barème complet (résultats et actions) et la taille du bracket.

**Responsive.** Filtres empilés et barres d'actions en grille sur mobile, barre d'enregistrement collée en bas de l'écran dès qu'une modification est en attente. Aucun débordement horizontal à 375 px ni à 1366 px.
