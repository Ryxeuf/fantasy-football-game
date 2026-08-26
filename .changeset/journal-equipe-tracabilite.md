---
"@bb/server": minor
"@bb/web": minor
---

Journal d'équipe : tracer chaque modification, son auteur et son résultat.

**Le manque.** Les écarts de trésorerie et de VE observés en ligue n'étaient reconstituables par aucune source. `AuditLog` ne trace que les actions **admin** — un achat de coach, une économie d'après-match ou un recalcul de VE n'y figurent jamais. `appendAudit` (commissaire) y écrit bien, mais indexé par admin et par action, pas par équipe. `TeamPlayerStatusEvent` ne couvre que morts et licenciements. Et surtout : **aucun ne stocke l'état obtenu**.

**Le nouveau modèle `TeamAuditEvent`** (append-only) répond à trois questions par étape : **qui** (identifiant + rôle + libellé figé au moment de l'acte + impersonation), **quoi** (slug d'action, charge utile, diff champ par champ) et **quel résultat** (snapshot complet de l'équipe après l'étape, plus trésorerie / VE / VEA dénormalisées et leurs variations).

**Une opération = plusieurs étapes.** Un achat de joueur débite la trésorerie PUIS `updateTeamValues` réécrit la VE. `correlationId` (= requestId HTTP, recoupable avec les logs) les regroupe, `step` les ordonne, et chacune publie son état résultant — sans quoi un chiffre faux reste indiscernable d'un chiffre juste calculé sur un état intermédiaire faux.

**Couverture.** Création (build et depuis un roster), sauvegarde de roster, achats entre matchs, staff, joueurs, améliorations et pool de PSP, Star Players, suppression, crédit du reliquat de budget, recalcul de VE, économie d'après-match de ligue et son annulation, achats d'après-match, mécène, morts et licenciements. Les actions commissaire sont miroitées en une greffe unique dans `appendAudit`. Une garde CI (ratchet) fait échouer les tests dès qu'un module écrit sur `Team` / `TeamPlayer` / `TeamStarPlayer` sans journaliser : un journal ne vaut que s'il est exhaustif.

**Consultation.** Page `/me/teams/<id>/journal` pour le coach (accès aussi à l'admin et au commissaire de la ligue concernée ; l'IP de l'auteur reste réservée aux admins) : une carte par opération, dépliable en étapes, avec le diff et l'état résultant à chaque pas.

**Recherche transversale admin** (`/admin/team-journal`) : recherche sur toutes les équipes à la fois — texte libre extensible aux charges utiles, équipe, coach, auteur, action, rôle, source, opération, fenêtre temporelle, seuils de variation **en valeur absolue** (un crédit anormal compte autant qu'un débit), échecs seuls, impersonation seule ; tris par date ou par impact. Agrégats par action / rôle / équipe, et export **CSV** (BOM UTF-8, montants en or bruts, protection contre l'injection de formule) ou **NDJSON** (une ligne parsable par étape), plafonné avec le total réel en en-tête plutôt qu'une troncature silencieuse.

Schéma additif appliqué par `db push`, lisible sans backfill — le journal démarre vide. Coupe-circuit d'exploitation `TEAM_AUDIT_DISABLED=1`, qui court-circuite aussi les captures d'état.
