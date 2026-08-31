---
"@bb/game-engine": minor
"@bb/server": minor
"@bb/web": minor
---

Feuille de match : le catalogue d'embauche remplace la saisie libre, et le roster dit enfin le vrai.

**Les achats de l'étape 4 étaient une saisie libre.** Le sélecteur de poste dérivait sa liste de l'EFFECTIF de l'équipe : un poste jamais recruté — un Lanceur, un Blitzeur — n'était tout simplement pas proposable, pendant qu'un poste au quota plein (0-2) l'était toujours. Le montant, lui, était un champ nombre sans garde-fou, alors que c'est lui qui débite la trésorerie : une faute de frappe passait directement en base, et rien ne rattachait le prix au roster.

`league-sheet-purchase-options` (module pur) résout maintenant les deux : postes du catalogue du roster avec leur quota et leur prix, staff avec ses plafonds, effectif borné par le PLAFOND DU FORMAT (16 en BB11, 11 en Sevens) et non par un 16 codé en dur. Un poste complet reste proposé, grisé, avec son quota (« Blitzeur Haut Elfe (2/2) — complet ») plutôt que de disparaître sans explication, et le prix se remplit au choix. La règle BB de l'achat après création est appliquée : une relance Haut Elfe à 50 000 po en construction s'achète 100 000 po en fin de match. Le montant reste corrigeable pour un ajustement de ligue, mais un écart au prix catalogue est signalé sous la ligne. Sans catalogue (roster introuvable), la saisie reste libre comme avant.

**Le trait « Haine (X) » s'affichait en anglais sur le roster.** Ses variantes sont créées à la volée à la validation d'une feuille de match : un catalogue de compétences déjà chargé par le navigateur ne connaît pas `hate-orque`, et le badge retombait sur le slug brut. `hateSkillLabelFr` le francise sans attendre le rechargement du catalogue. La slugification étant destructrice (« Homme Lézard » → `homme-lezard`), l'accent ne se recalcule pas : les mots-clés connus (positions Season 3 et Star Players) sont indexés par leur slug de Haine.

**Le roster affichait toutes les Ligues régionales du roster**, celles non retenues barrées. Une équipe n'en retient qu'UNE à sa création, et elle seule débloque ses Star Players et ses Coups de Pouce : les autres ne la concernent pas, et les montrer barrées laissait croire à un choix perdu. Seule la Ligue retenue reste affichée — sauf pour une équipe antérieure à la règle, ou si le slug enregistré a disparu du catalogue, cas où la liste complète vaut mieux qu'une section vide.

**Les éliminations ne rapportent pas toutes des PSP, et rien ne le disait.** Un rappel de règle apparaît sous le sélecteur de type d'évènement pour les quatre types concernés : Élimination sur Action Spéciale (aucun PSP pour l'auteur, sauf « Innovateur Violent » qui lui rend les PSP d'Élimination), auto-éliminations et sortie par le public. Le coach saisissait une sortie, ne voyait rien arriver dans les PSP estimés, et pouvait conclure à une perte de saisie.

Au passage, `.gitignore` avalait `docs/screenshots/` et `tests/screenshots/` via une règle `screenshots/` qui matche à n'importe quelle profondeur : les captures de preuve et leur harnais sont désormais réellement versionnés.
