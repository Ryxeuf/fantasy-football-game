---
"@bb/server": minor
"@bb/web": minor
---

Feuille de match & séquence de fin de match : lot de 8 correctifs/évolutions.

**Évolutions de joueurs.** Une compétence DÉJÀ POSSÉDÉE n'est plus proposée ni acceptée (le tirage aléatoire l'excluait déjà, le choix libre non : le serveur refuse désormais avec `skill-already-owned` et l'éditeur retire ces compétences du pool). Les PSP du **Joueur du Match** sont crédités DÈS la saisie : un JDM sans autre statistique n'apparaissait pas dans les paliers d'évolution avant la validation commissaire, alors que celle-ci les lui attribuait bien.

**Séquence de fin de match (livre p.68).** Les évolutions sont désormais appliquées à l'étape 3, donc AVANT les embauches de l'étape 4 (et les renvois qui suivent) : l'ordre compte, une compétence gagnée par un journalier change son prix de recrutement, et la VE au moment des achats dépend des évolutions du match. Un joueur **mort ou licencié** libère sa place (et son numéro) au roster pour les recrutements.

**Gel du match.** L'état COMPLET des deux équipes — joueurs, staff (relances, pom-pom girls, assistants, apothicaire), VE/VEA, trésorerie, fans dévoués et journaliers alignés — est figé dès l'OUVERTURE de la feuille, et plus seulement à la première soumission. Les feuilles antérieures sont rattrapées à la lecture en préservant leurs valeurs déjà figées.

**Acteurs du match.** Les **Star Players engagés** en coup de pouce sont proposés comme acteurs et cibles d'évènement (TD, sorties, Joueur du Match) et résolus dans le journal, comme les journaliers. Les **journaliers ayant joué** peuvent être recrutés en fin de match : ils perdent Solitaire, gardent leurs PSP et l'évolution prise à l'étape 3, qui renchérit leur prix.

**Confort de saisie.** La trésorerie disponible (cagnotte figée + gains du match) est rappelée dans les achats, avec le reste après dépenses et une alerte en cas de dépassement.

**Playoffs.** Le bracket, généré automatiquement à la clôture de la phase régulière, reste invisible des coachs tant que le commissaire ne l'a pas PUBLIÉ — le temps de vérifier les seeds. Nouvelle bascule « Publier les playoffs » côté commissaire. Les saisons dont le bracket est déjà consulté par la ligue restent visibles (le schéma est appliqué par `db push`, sans backfill : `LeagueSeason.playoffsPublished` est un booléen nullable où `null` vaut « saison antérieure, visible »).
