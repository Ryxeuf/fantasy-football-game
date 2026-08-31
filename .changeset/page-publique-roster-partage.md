---
"@bb/server": minor
"@bb/web": minor
---

Page publique d'un roster partagé : compétences lisibles, coût des joueurs, staff chiffré, logo et fluff de l'équipe.

**Les compétences étaient des slugs.** `/r/:token` rendait `parseSkillList(p.skills).join(", ")`, donc « block, dodge » — les identifiants anglais du moteur — sur la seule page du site qu'un coach fait ouvrir à des inconnus. L'effectif passe par les mêmes composants que la fiche du coach : libellés localisés, compétence ACQUISE distinguée de la compétence de BASE de la position (source : les compétences par défaut servies par la base, pas la liste compilée du moteur), accès primaire/secondaire, mots-clés et description au survol. Le catalogue est résolu côté serveur et passé au `SkillsCatalogProvider` : les noms sont corrects dès le HTML initial, sans le flash « slug puis libellé » — un lien partagé n'est souvent ouvert qu'une fois.

**L'effectif affiche la valeur de chaque joueur.** Nouvelle colonne « Coût », alimentée par `playerValues` que sert désormais `GET /api/public/teams/:token`. C'est la même résolution que la valeur d'équipe (coûts de poste en base, barème de l'édition, surcoût Élite) : un joueur deux fois amélioré ne peut plus s'afficher à son tarif de recrue pendant que la VE, juste au-dessus, le compte 90 000 po plus cher. Le web ne re-dérive rien ; à défaut du champ, il replie sur le tarif d'embauche du poste.

**Le staff dit ce qu'il a coûté.** Les cinq postes (relances, cheerleaders, assistants, apothicaire, fans dévoués) portent leur coût à côté de leur effectif — le premier fan dévoué reste offert, et un poste non acheté n'affiche pas « 0K po ». S'y ajoutent la valeur d'équipe actuelle, la trésorerie, le coût de l'effectif et celui des Star Players, tous calculés par le serveur (`staffConfig`, `budgetSummary`).

**L'équipe a un visage.** Le logo uploadé par le coach — sinon l'emblème canonique de son roster — ouvre la page, et le fluff est mis en exergue au lieu de se noyer dans un paragraphe gris. Sous `md`, l'effectif passe en cartes : un lien partagé s'ouvre surtout au téléphone, et le tableau compte maintenant dix colonnes.

**Au passage.** La réponse publique était la ligne `Team` brute, `ownerId` et `shareToken` compris ; c'est désormais une vue explicite, si bien qu'une colonne ajoutée plus tard au modèle ne peut plus devenir publique par accident. Les trois enrichissements sont isolés : un catalogue incomplet dégrade la page, il ne la fait jamais tomber, et la lecture publique ne persiste rien (contrairement à la fiche du coach, qui auto-répare la VE — un visiteur anonyme n'écrit pas dans l'équipe d'autrui).
