---
"@bb/server": minor
"@bb/web": minor
---

Renommer son équipe après la création, même engagée en compétition.

**Le manque.** Le nom d'équipe se saisissait à la création et n'en bougeait plus. Deux routes acceptaient bien un `name` — `PUT /team/:id` et `PUT /team/:id/roster` — mais aucune ne sert de renommage : la première exige la liste **complète** des joueurs (c'est une sauvegarde de roster, pas un renommage), et les deux passent par le verrou anti-triche, donc répondent 403 dès que l'équipe est engagée dans un match, une ligue ou une coupe. Autrement dit : une faute de frappe à la création devenait définitive au premier match, et un coach qui rejoignait une ligue ne pouvait plus aligner le nom de son équipe sur celui de sa bande.

**Une route dédiée, hors du verrou.** `PATCH /team/:id/name`, réservée au propriétaire, autorisée quelle que soit l'ancienneté de l'équipe. Le nom est **cosmétique** : il n'entre ni dans le calcul de la valeur d'équipe, ni dans le budget, ni dans la composition. C'est exactement la posture déjà retenue pour l'identité d'un joueur (`PATCH /team/:id/players/:playerId/identity`), éditable en équipe engagée pour la même raison. Un match déjà démarré n'est pas affecté : le nom est **copié** dans l'état de jeu au coup d'envoi, l'état en cours et les replays gardent donc celui qu'ils ont figé.

**La contrepartie, c'est le journal.** Chaque renommage effectif écrit une étape `team.rename` dans le journal d'équipe, avec l'état capturé **avant** l'écriture — le diff porte donc l'ancien et le nouveau nom. Un nom qui change en pleine ligue reste ainsi reconstituable, et arbitrable par le commissaire. Renommer avec le nom courant est un succès sans écriture ni étape : sans quoi chaque ouverture du champ polluerait le journal.

**Côté site**, le nom devient éditable en place sur la fiche d'équipe, à côté du titre — y compris quand le bouton « Modifier l'équipe » est verrouillé, ce qui est précisément le cas où le besoin se pose.

Aucune migration : la colonne existe déjà et ne porte aucune contrainte d'unicité. Les bornes du renommage sont celles de la création (nom non vide, 100 caractères au plus).
