---
"@bb/server": minor
"@bb/web": minor
---

Documents officiels de compétition : un règlement PDF, un calendrier ou une affiche s'attachent désormais à une ligue comme à une coupe.

**Le règlement vivait hors du site.** Une ligue se joue sur des règles écrites, mais rien dans le produit ne permettait d'y attacher un fichier : les commissaires collaient le texte dans la description, l'envoyaient sur Discord ou l'hébergeaient ailleurs, et personne ne savait quelle version faisait foi. Le modèle `CompetitionDocument` porte maintenant ces fichiers, déposés par le **commissaire (créateur) ou un admin**, **à la création comme à n'importe quel moment ensuite** — y compris une fois la compétition démarrée. C'est volontaire et c'est la différence avec les paramètres de scoring, figés dès le premier match joué : un règlement doit pouvoir être corrigé en cours de saison.

**Une seule table, une seule règle, deux familles de compétitions.** Le rattachement est polymorphe (`leagueId` XOR `cupId`, les deux nullables) plutôt que dupliqué en deux tables : la règle métier est identique côté ligue et côté coupe, la dupliquer l'aurait fait diverger. On garde les cascades Prisma natives et une seule table à administrer ; l'invariant « exactement une des deux clés » n'étant pas exprimable en Prisma, il est tenu par `services/competition-documents`, seul chemin d'écriture. Même logique pour les routes : un jeu de handlers monté sur `/api/competitions/:kind/...` (`leagues` | `cups`).

**Les trois gardes des uploads existants, plus le PDF.** Corps binaire brut plafonné à **10 Mo par le parser lui-même** (413 avant toute lecture complète en mémoire), type déterminé par les **octets de signature** et jamais par le `Content-Type` ni l'extension (une archive ZIP renommée `.pdf` sort en 415), nom de fichier **régénéré côté serveur** — aucune portion du nom client ne survit, et la suppression revalide le nom avant tout `unlink`. Formats acceptés : PDF, PNG, JPEG, GIF, WEBP. La liste est publique pour une compétition publique (un règlement a vocation à circuler) et réservée aux membres pour une compétition privée.

**Côté interface.** Un panneau « Documents officiels » sur la fiche de ligue et la fiche de coupe (téléchargement pour tous, dépôt / renommage / retrait pour le commissaire et les admins) ; un sélecteur de fichiers dans les deux formulaires de création, déposés juste après la création puisque l'identifiant n'existe pas avant — et si ce dépôt échoue, la compétition reste créée, l'échec est signalé et une nouvelle soumission ne rejoue que l'upload au lieu de créer un doublon. La console `/admin/competition-documents` donne la vue transverse : filtres par famille et recherche, pagination, renommage, purge.

**Au passage.** Le journal d'audit n'écrivait rien sur le miroir sqlite dès qu'un seul des deux instantanés (`oldValue` / `newValue`) était fourni : la colonne y est `String?` alors que `Prisma.JsonNull`, exigé par le `Json?` de Postgres, est un objet à l'exécution. L'insert échouait et `safeRecordAdminAction*` avalait l'erreur. La sentinelle s'aligne désormais sur le provider, comme le fait déjà `team-audit-search`.
