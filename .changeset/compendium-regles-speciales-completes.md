---
"@bb/web": patch
---

Compendium : les 7 règles spéciales d'équipe sont publiées.

La page `/compendium/equipes-ligues-regles-speciales` n'en listait que 3 (Bagarreurs Brutaux, Chantage et Corruption, Favori de…). Capitaine, Déferlement, Maîtres de la Non-vie et Trois-quarts à vil prix — pourtant portées par le catalogue du moteur et appliquées en jeu — n'apparaissaient nulle part.

- Ajout des 4 règles manquantes (résumés reformulés, structure et `sourcePages` inchangées) et tri alphabétique des 7 sections.
- Correction du nom de la « Coupe Dé à Coudre Halfling », publié en « Coupe De À Coudre Halfling ».
- Garde-fou CI `team-rules-consistency.test.ts` : la couverture compendium ↔ moteur est vérifiée dans les deux sens, pour les règles spéciales comme pour les 10 Ligues. Une règle ajoutée au moteur sans être publiée fait désormais échouer la CI.
