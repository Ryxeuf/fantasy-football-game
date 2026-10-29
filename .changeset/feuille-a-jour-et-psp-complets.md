---
"@bb/server": minor
"@bb/web": minor
---

Feuilles de match de ligue : un état d'équipe à jour, des PSP complets.

**Une feuille ouverte trop tôt restait sur un état périmé.** La feuille fige les deux équipes à son ouverture : ouverte avant la validation de la journée précédente, elle ignorait tout de ce match (PSP, blessures, morts, trésorerie, fans, évolutions). Elle ne s'ouvre plus tant qu'une rencontre précédente de l'une des deux équipes n'est pas close, et l'écran indique laquelle valider d'abord ; le commissaire peut l'ouvrir quand même pour une journée reportée. Si une rencontre précédente est validée — ou invalidée puis corrigée — après l'ouverture, la feuille le signale, et un bouton « Mettre à jour la feuille » refige les équipes dans leur état actuel tant que personne n'a soumis, en gardant ce qui est déjà saisi.

**Une élimination soignée par l'Apothicaire (ou la Régénération) ne comptait plus.** Saisie sans gravité, elle disparaissait : ni sortie, ni points bonus, ni les PSP de son auteur. Elle compte désormais, et une nouvelle gravité « Aucune séquelle (Apothicaire / Régénération) » permet de le dire explicitement — l'élimination et ses PSP restent acquis, sans blessure pour la victime.

**Le lanceur d'un Lancer de Coéquipier ne gagnait rien.** Un « Lancer de coéquipier réussi » rapporte désormais 1 PSP au lanceur (Lancer Sécurisé), en plus du PSP de l'atterrissage pour le joueur lancé.

Les feuilles déjà validées des saisons en cours sont rattrapées automatiquement à la prochaine consultation du classement.
