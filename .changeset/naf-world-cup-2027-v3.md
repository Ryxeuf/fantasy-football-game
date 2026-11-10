---
"@bb/game-engine": minor
"@bb/server": minor
"@bb/web": minor
---

Nouveau règlement de tournoi : NAF World Cup 2027 V3.0.

- **Règlement distinct du V2.1** (`naf_world_cup_2027_v3`) : les équipes, ligues et coupes créées sous V2.1 gardent leurs budgets. Il est proposé dès le déploiement ; le seed crée sa ligne sans toucher celle du V2.1.
- **Tableau des tiers V3.0** : budgets de 1 100 à 1 200 kpo, pools de 44 / 52 / 60 / 66 / 72 SPP. Les colonnes 44 et 52 donnent un joueur à 2 compétences et aucun Star Player ; les colonnes 60, 66 et 72 en donnent deux et ouvrent les Star Players.
- **Chaque Star Player recruté retire un cumul** : nouvelle règle du pack, portée par le champ `stackReductionPerStarPlayer` (éditable dans l'onglet Star Players de l'admin). Elle est appliquée à la création d'équipe, à l'ajout d'une compétence après coup et dans le builder, dont le quota affiché suit les Star Players choisis.
- **Star Players** : 17 noms bannis (liste révisée), taxe de 18 / 24 / 32 SPP par tranches 0-200 / 201-300 / 301+ kpo.
- **Coups de pouce, barème de compétences et points** : inchangés par rapport au V2.1.
- **Correctif** : un plan de compétences refusé par le règlement est désormais rejeté avant la création de l'équipe (elle était créée puis laissée en place).
