---
"@bb/server": minor
"@bb/web": minor
---

Page de ligue plus lisible (pliage, prochains matchs, barème complet) et trois corrections de la feuille de match.

**La page d'une ligue se replie.** Une saison de 14 journées produisait une page interminable qu'il fallait parcourir en entier pour atteindre le classement. Chaque journée du calendrier se replie depuis son en-tête — qui reste visible (numéro, statut, avancement), de sorte qu'on ne perd jamais ses repères — et un bouton « Tout replier » / « Tout déplier » agit sur le calendrier complet, en ne touchant que les journées **visibles** (donc filtrées). La zone Classement se replie elle aussi, ainsi que **chaque poule séparément** : avec 4 poules, le coach ne garde ouverte que la sienne.

**« Vos prochains matchs ».** Le calendrier dit qui joue quand ; il ne disait pas au coach ce qu'**il** joue ensuite, ce qui l'obligeait à balayer les journées une à une. La nouvelle zone liste ses 3 prochaines rencontres non jouées : numéro de journée (ancré sur la journée du calendrier), adversaire, côté domicile/extérieur, date prévisionnelle et lien direct vers la feuille de match. Le tri est totalement déterministe (journée croissante, puis date prévisionnelle, celles sans date en dernier).

**Le système de points descend au-dessus du classement, avec les points bonus.** Le barème vivait tout en haut de la page, loin de la seule colonne qu'il explique. Il porte désormais aussi les **règles de points bonus** de la ligue, jusqu'ici visibles du seul commissaire depuis son écran d'édition : un coach voyait la colonne « Bonus » du classement sans aucun moyen de savoir comment la gagner.

**Une feuille de match passée ne bouge plus.** Les PSP affichés repartaient du roster **live** pour savoir qui porte « Innovateur Violent ». Une compétence gagnée à l'étape 3 de la séquence de fin de match (livre p.68) se rétro-appliquait donc à **toutes** les feuilles du joueur : chaque élimination par Action Spéciale déjà consignée affichait soudain +2 PSP, alors que les PSP persistés, eux, étaient justes. Les compétences lues sont maintenant celles du **coup d'envoi**, relues dans le snapshot gelé de la feuille — le gel fait foi, et la lecture comme la validation passent par la même résolution.

**« Vol Fatal » rapporte enfin ses PSP.** Règle BB S3 : lors d'un Lancer de Coéquipier, le joueur lancé qui atterrit sur une case occupée et plaque l'adversaire gagne les PSP d'Élimination si celui-ci sort — 2, ou 3 sous « Bagarreurs Brutaux ». L'évènement d'atterrissage ne portait ni cible ni blessure : la sortie n'était pas saisissable. Elle l'est, avec le rappel de règle qui va avec, et ne crédite que les porteurs de la compétence.

**Deux corrections d'affichage.** Les compétences **Scélérates** s'affichaient en gris, comme les Traits (elles manquaient aux trois tables de couleurs dupliquées et tombaient sur le cas par défaut) : elles ont désormais leur teinte ambre, servie par une source unique. Et l'avant-match de la feuille de match dit « **Petite Monnaie** », le terme officiel FR, au lieu de l'anglicisme « Petty cash ».
