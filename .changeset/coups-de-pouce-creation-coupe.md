---
"@bb/game-engine": patch
"@bb/server": patch
"@bb/web": patch
---

Les coups de pouce s'achètent à la création de l'équipe dans une coupe.

**Une coupe rejoue son roster d'inscription à chaque ronde.** Les coups de pouce y suivaient pourtant la logique d'une ligue : rachetés avant chaque rencontre, sur une Petite Monnaie à laquelle s'ajoutait la trésorerie de l'équipe — une trésorerie qui, en coupe, se rejoue elle aussi à chaque ronde. Les tournois (NAF World Cup 2027…) font l'inverse : on paie ses coups de pouce une fois, sur le budget de construction, et ils valent pour toute la compétition.

**Une coupe choisit désormais son régime** : à la création de l'équipe (`build`, le défaut d'une coupe BB11 neuve et le seul permis sous règlement de tournoi), en avant-match (`match`, l'état des coupes existantes, désormais sans trésorerie) ou jamais (`none`). Sans règlement, le commissaire peut restreindre la liste des coups de pouce autorisés.

**Au builder**, une section « Coups de pouce » vend le catalogue de la coupe pour ce roster (prix, plafonds, remise d'équipe et plafond « Arme Secrète » du règlement) ; le serveur tarife lui-même. Les coups de pouce achetés sont figés dans le roster d'inscription, rappelés sur la feuille de match (écran et PDF) sans aucun achat d'avant-match, et listés sur la fiche d'équipe. « Adapter à la coupe » reprend ceux que la coupe autorise.

**Corrections au passage** : les Star Players recrutés à la création apparaissent enfin sur la feuille de coupe ; l'inscription telle quelle compare le budget à la dépense de construction (Star Players et coups de pouce compris) plutôt qu'à la VE, et refuse une équipe porteuse de coups de pouce que la coupe ne vend pas ; sous règlement, l'or non dépensé à la création est perdu.
