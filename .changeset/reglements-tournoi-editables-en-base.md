---
"@bb/server": minor
"@bb/web": minor
---

Les règlements de tournoi deviennent éditables depuis la console admin.

Ils vivaient uniquement dans le registre `@bb/game-engine` : ajouter ou corriger un pack demandait une PR et un déploiement, là où rosters, compétences, positions et Star Players s'éditent déjà depuis `/admin/data/*`. Il n'y avait d'ailleurs aucune entrée de menu pour eux.

- **Stockage** : modèle `TournamentRuleset` (slug unique, `enabled`, `definition` JSON) + migration additive. Aucune clé étrangère depuis Team/League/Cup — une compétition garde son règlement même désactivé.
- **Parser** : `tournament-ruleset.schemas` valide le JSON à l'écriture (saisie admin refusée avec le chemin du champ fautif) comme à la lecture (un JSON corrompu ne remonte jamais dans le moteur). Il vérifie aussi la cohérence : tranches de taxe strictement croissantes et borne ouverte en dernier, coups de pouce connus du catalogue et non tarifés deux fois. `Infinity` (borne ouverte) se stocke `null` et se relit correctement, et la colonne est acceptée en objet natif (PostgreSQL) comme en chaîne (miroir SQLite).
- **Résolution** : la base prime, le registre du moteur reste le filet — table vide, base injoignable ou ligne invalide, l'application est toujours servie. Le seed amorce la table sans jamais écraser une correction admin.
- **API** : CRUD admin (avec validation à blanc), et `GET /api/tournament-rulesets` pour le web — qui ne lit plus le registre nulle part.
- **Admin** : entrée dédiée, liste indiquant l'origine de chaque définition (base ou moteur), et éditeur par sections — identité, tiers par roster (ajout depuis la liste réelle des rosters), compétences, Star Players, coups de pouce, classement, plus un onglet JSON pour coller un pack entier. Les erreurs du serveur s'affichent au pied du champ concerné et les onglets fautifs se signalent.
