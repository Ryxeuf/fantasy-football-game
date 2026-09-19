---
"@bb/server": patch
---

Une feuille de match reste invalidable après le recrutement d'un journalier ou d'un mort relevé.

**Le commissaire ne pouvait plus corriger une feuille dont le nécromant avait recruté son Zombie relevé.** L'invalidation répondait « Reversion impossible : purchase-consumed — un joueur acheté après ce match a déjà joué ou progressé », et la feuille devenait définitive. Le joueur en cause n'avait pourtant rien fait APRÈS le match : c'était le Trois-quart relevé par Maîtres de la Non-vie, recruté gratuitement à l'étape EMBAUCHES. Même refus pour un journalier recruté.

**Le garde-fou comparait au mauvais point de départ.** Un journalier ou un mort relevé recruté rejoint le roster avec ce qu'il a gagné en jouant ce match — un match joué, ses PSP restants, l'évolution prise à l'étape 3. Le contrôle qui protège la réversion (ne jamais supprimer un joueur qu'un autre match utilise déjà) lisait ces compteurs contre zéro, la référence d'un joueur acheté ordinaire, et voyait donc un usage postérieur là où il n'y avait que le match lui-même.

**La référence est désormais l'état du joueur à sa création.** Elle est consignée avec la feuille à la validation, et redérivée des achats déjà enregistrés pour les feuilles validées avant ce correctif — aucune saisie à refaire. Un recrutement qui a réellement rejoué, progressé ou est mort depuis reste protégé, et l'invalidation retire toujours le joueur recruté, rend l'or et ressuscite le mort adverse ; une nouvelle validation le recrute à nouveau.
