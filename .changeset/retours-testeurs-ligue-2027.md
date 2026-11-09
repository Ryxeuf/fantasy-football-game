---
"@bb/server": minor
"@bb/web": minor
"@bb/game-engine": patch
---

Retours testeurs « ligue 2027 » : feuille de match, règles 2025, gestion de ligue et confort.

- **Coups de pouce d'avant-match** :
  - le budget de l'outsider compte la dépense du favori, à la lecture comme à la validation ;
  - un coach n'enregistre plus que son côté et ne peut donc plus écraser les achats adverses ;
  - la feuille se relit en direct (toutes les 15 s, et au retour sur l'onglet) ;
  - le favori confirme ses achats avant l'outsider (« J'ai fini mes achats ») ;
  - à VEA égales, aucune trésorerie n'est mobilisable.
- **Un coach possède les deux équipes** : sélecteur « Je saisis pour », soumission par côté et avertissement « même coach ».
- **Règles 2025** :
  - journaliers limités aux Trois-quarts 0-16 (p.94) ;
  - Esquive en Force au texte et à la mécanique 2025 ;
  - six descriptions de compétences corrigées ;
  - audit des descriptions Saison 3 contre le livre.
- **Commissaire** :
  - renommer ou supprimer une journée ;
  - supprimer une saison où rien n'a été joué ;
  - réinitialiser le bracket de play-offs ou remplacer un qualifié dans une rencontre non jouée ;
  - retirer une équipe en cours de saison (forfait ou annulation des rencontres restantes).
- **Listes** : filtre « Toutes / Les miennes » et rôle du lecteur sur `/leagues`, `/leagues/archived` et `/cups`.
- **Confort** :
  - un dé signale les compétences tirées au hasard ;
  - le staff et les fans se choisissent dans l'assistant de première équipe ;
  - le numéro NAF du profil est vérifié automatiquement auprès de thenaf.net.
