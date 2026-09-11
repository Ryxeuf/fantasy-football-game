---
"@bb/server": minor
"@bb/web": patch
---

Une sortie est une élimination qui rapporte des PSP — une agression est une agression.

**Le summarizer comptait comme sortie toute élimination blessante.** Une agression qui blessait créditait son auteur d'une sortie (donc 2 PSP), et le compteur d'équipe — celui des colonnes Sor+/Sor- du classement et des points bonus « sorties infligées » — additionnait aussi les sorties par le public, les Actions Spéciales sans « Innovateur Violent » et les atterrissages sans « Vol Fatal ». Sur le premier match d'une ligue : 5 sorties affichées pour 4 éliminations sur blocage + 1 agression. Le classement des cogneurs de saison réécrivait encore une autre règle.

**Une définition unique.** `eliminationEarnsSpp` répond « cette élimination rapporte-t-elle les PSP d'Élimination à son auteur ? » : blocage toujours ; Action Spéciale avec « Innovateur Violent » ; atterrissage avec « Vol Fatal » ; agression sous la Prière à Nuffle 13 « **Frénésie d'Agression** », désormais câblée ; jamais pour le public, une esquive ratée, une temporisation. Le compteur d'équipe et la stat-line du joueur en dérivent tous deux. Une agression reste comptée dans les agressions (colonne Agr), sa blessure est consignée, mais elle ne compte plus dans les sorties ni dans les PSP.

**Les exceptions sont lues au bon endroit, une seule fois.** Compétences du coup d'envoi (relues dans le gel de la feuille) et Prières de la feuille sont assemblées par un module partagé, consommé par la feuille (lecture et validation), par les classements individuels de la saison (cogneurs, tueurs) et par la resynchronisation — aucun des trois ne peut diverger.

**Les feuilles déjà validées se rattrapent.** Le script `db:resync-sheet-casualties` (simulation par défaut, `-- --apply` pour écrire) rejoue, feuille par feuille, les seuls deltas qui dépendent des sorties : sorties pour / contre des participants, sorties de carrière et PSP des joueurs (2, ou 3 en Bagarreurs Brutaux), points bonus du pairing (bonus commissaire conservé) et snapshot du match, réécrit pour qu'une invalidation reprenne le bon montant. Idempotent, journalisé dans le journal d'équipe, saisons clôturées ignorées.

**Côté feuille**, le rappel de règle sous le type d'évènement dit qu'une agression compte en agressions, pas en sorties — sauf Frénésie d'Agression — et que la sortie par le public a sa propre colonne.
