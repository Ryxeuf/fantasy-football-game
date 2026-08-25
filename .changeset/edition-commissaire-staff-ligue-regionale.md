---
"@bb/web": minor
"@bb/server": minor
---

Édition d'une équipe par le commissaire : refonte de l'écran, staff et Ligue régionale.

**Ce qui manquait.** Le commissaire pouvait corriger les joueurs (PSP, compétences, caractéristiques, identité) et la trésorerie, mais pas le staff — relances, cheerleaders, assistants, apothicaire, fans dévoués — qui n'est modifiable par le coach que tant que l'équipe n'est engagée nulle part. Quant à la Ligue régionale, choisie à la création et immuable ensuite, une erreur de saisie n'était rattrapable par personne, alors qu'elle décide des Star Players recrutables et des Coups de Pouce de toute la saison.

**Staff.** Un onglet dédié, avec pour chaque élément ses bornes réelles (les plafonds du roster × format servis par la base : le Sevens plafonne à 6 relances, certains rosters n'ont pas droit à l'apothicaire) et son coût unitaire. Le coût du changement est annoncé avant enregistrement, et n'est débité de la trésorerie que si la case « Répercuter sur la trésorerie » est cochée : corriger une saisie ne doit pas refacturer une relance déjà payée par le coach. Le panneau trésorerie gagne des raccourcis ±10 k / ±50 k et la projection du solde.

**Ligue régionale.** Les Ligues ouvertes au roster sont présentées en cartes (libellé, description, alignements apportés — « Favori de Khorne » et non plus un slug), l'actuelle est marquée, et une option permet de revenir à « aucun choix enregistré ». Après l'enregistrement, les Star Players devenus inéligibles sont listés sans être retirés : l'arbitrage revient au commissaire.

**Écran.** L'éditeur empilait dans une seule colonne la trésorerie puis tous les contrôles de tous les joueurs — plus de soixante champs de saisie sur un roster complet, sans recherche ni confirmation d'action. Il devient un dialogue en trois onglets (effectif / staff & trésorerie / Ligue régionale) : recherche par nom, numéro ou poste, filtre Tous / Actifs / Morts, une ligne lisible par joueur qui se déplie pour l'édition, les cinq caractéristiques éditables d'un coup, un message de confirmation après chaque action et les champs préservés quand un appel échoue. Le dialogue se ferme à l'Échap ou au clic sur le fond, et passe en plein écran sur mobile.

Toutes ces actions restent réservées au commissaire de la ligue et journalisées.
