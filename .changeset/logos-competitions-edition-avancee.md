---
"@bb/web": minor
"@bb/server": minor
"@bb/game-engine": minor
---

Logos d'équipe en compétition, et édition avancée d'une équipe après sa création.

**Logos.** `/me/teams` n'affichait que le nom et le badge de roster : un logo uploadé n'apparaissait qu'une fois la fiche ouverte. Il est désormais rendu dans la liste du coach, dans les inscrits, le classement, les podiums, la liste de matches et le bracket d'une coupe, dans les participants et le bracket de playoffs d'une saison de ligue, et dans les tops par équipe des classements de saison. `logoUrl` a été ajouté aux `select` d'équipe correspondants côté serveur. En l'absence de logo uploadé, le logo programmatique du roster prend le relais comme avant.

**Édition avancée.** Le profil d'un joueur était figé après la création : l'ajout de compétence ne savait dépenser que ses SPP, nuls tant qu'il n'a pas joué, et rien ne permettait de revenir sur un choix fait au builder. Sur une équipe libre (non engagée en ligue, coupe ou match), la fiche d'édition propose maintenant la même bascule « Édition avancée » qu'à la création : réglage du pool de PSP de construction, achat de compétences financé **en priorité sur ce pool** puis sur les SPP du joueur, annulation d'une amélioration (la compétence est retirée ou la caractéristique rendue, les PSP retournent à leur source), et recrutement de Star Players. Le règlement de tournoi retenu à la création impose son barème PSP et ses restrictions à tout achat sur le pool ; une amélioration gagnée en match continue de suivre les règles Blood Bowl standard. Le pool reste verrouillé quand une coupe l'impose, et ne peut pas descendre sous les PSP déjà dépensés.

**Star Players.** Le sélecteur — à la création comme à la modification — dit désormais POURQUOI une recrue est impossible : interdite par le règlement, budget insuffisant (avec les montants), plus de place dans l'équipe, ou partenaire de paire indisponible. Les Star Players bannis par un règlement restent affichés, désactivés avec leur motif, au lieu de disparaître de la liste. Le plafond de joueurs suit le format (11 en Sevens) au lieu d'un 16 codé en dur.

**Modifications non enregistrées.** Quitter la fiche d'édition — lien interne, fermeture d'onglet — avec un nom d'équipe ou des joueurs modifiés déclenche une confirmation au lieu de perdre le travail en silence.
