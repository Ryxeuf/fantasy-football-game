---
"@bb/server": patch
---

Feuille de match : le prix recalculé d'un journalier recruté est celui débité, et le roster de la section Ligue n'affiche que la Ligue retenue.

**Le journalier recruté rejoignait le roster à sa vraie valeur sans que la trésorerie ne la paie (A138).** À la validation, le serveur recalcule le prix d'un journalier recruté à l'étape EMBAUCHES — coût du poste choisi + surcoût de l'évolution prise à l'étape 3, surcoût Élite, barème de l'édition — mais le débit de trésorerie restait celui du montant SAISI sur la feuille, qui n'est qu'un pré-remplissage côté coach. Un montant laissé à 0 créait le joueur à 60 000 po de valeur pour 0 po débité. Le débit suit désormais les achats enrichis par le serveur (`purchasesGoldDelta`), les autres achats gardant leur montant saisi.

**Le roster consulté depuis la section Ligue affichait toutes les Ligues régionales du roster (A159).** La règle « seule la Ligue retenue par l'équipe est affichée » n'était appliquée qu'à la page « Mon équipe ». `GET /leagues/:leagueId/teams/:teamId/roster` ne sert plus que la Ligue retenue (`regionalLeague` exposé), et retombe sur la liste complète pour une équipe antérieure à la règle ou dont le choix a quitté le catalogue.

Tests : la chaîne complète des journaliers d'un roster à deux Trois-quarts (Orques) est rejouée de bout en bout sur une vraie base (`leagues-sheet-journeymen-orc.spec.ts`) — poste par journalier et VEA re-figée (E37), PSP du journalier gobelin (A163), tirage « Hasard » servi par la feuille (A162), évolution acceptée (A161), recrutement au prix poste + évolution (A138). Les fixtures e2e seedent le roster orque (Trois-quart Orque 0-16 / Gobelin 0-4) et la table Agilité. Un test unitaire verrouille aussi la règle PSP des éliminations sur Action Spéciale sous « Bagarreurs Brutaux » (E30 : rien sans Innovateur Violent, 3 PSP avec).
