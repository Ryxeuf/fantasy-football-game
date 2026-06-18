# blog-media (delta)

Capability : gestion complète des images du blog côté admin (médiathèque,
upload, métadonnées éditables, suppression sûre, réutilisation) avec le **disque
comme source de vérité** (`BLOG_UPLOAD_DIR`, aucun modèle Prisma).

## ADDED Requirements

### Requirement: Médiathèque — listing paginé des images

L'admin DOIT pouvoir lister les images uploadées via
`GET /api/admin/blog/images`, avec recherche par sous-chaîne du nom
(`search`), pagination (`page`, `limit` ≤ 50) et tri (`sort` = `date` | `name` |
`size`, défaut `date` décroissant). Chaque entrée DOIT exposer `filename`,
`url`, `bytes`, `width`, `height`, `alt`, `uploadedAt` et `ext`. La liste DOIT
provenir d'un `readdir` des fichiers image réels du dossier ; un dossier absent
DOIT renvoyer une liste vide (pas d'erreur).

#### Scenario: Liste filtrée et paginée

- WHEN l'admin appelle `GET /images?search=orc&limit=24`
- THEN la réponse DOIT être `{ images, total }` limitée aux images dont le nom contient `orc`
- AND chaque image DOIT porter ses dimensions, son poids et sa date

#### Scenario: Dossier d'images inexistant

- WHEN aucune image n'a encore été uploadée (dossier absent)
- THEN `GET /images` DOIT répondre `{ images: [], total: 0 }` sans erreur

### Requirement: Métadonnées éditables sans base de données

Le texte alternatif et les dimensions d'une image DOIVENT être persistés sur le
disque dans un **sidecar JSON caché par image** (`.<image>.json`), sans modèle
Prisma. Les dimensions DOIVENT être calculées à l'upload (depuis le buffer) puis
backfillées paresseusement pour les images historiques. Le listing NE DOIT
jamais partir du sidecar (un sidecar orphelin DOIT être ignoré). Le texte
alternatif DOIT être modifiable via `PATCH /api/admin/blog/images/:filename`
(`null` = effacer).

#### Scenario: Édition du texte alternatif

- WHEN l'admin envoie `PATCH /images/<fichier>` avec `{ alt: "Un Troll" }`
- THEN le serveur DOIT persister `alt` dans le sidecar en préservant les dimensions
- AND répondre `{ image }` avec le `alt` à jour
- AND enregistrer une entrée d'audit `blog-image.update`

#### Scenario: Sidecar orphelin ignoré

- WHEN un sidecar existe pour une image absente du disque
- THEN le listing NE DOIT PAS faire apparaître d'image fantôme

### Requirement: Upload d'images depuis l'interface

La médiathèque DOIT permettre d'uploader des images depuis l'admin (bouton de
sélection de fichier **et** glisser-déposer, multi-fichiers), en réutilisant
`POST /api/admin/blog/upload`. L'upload DOIT capturer les dimensions de l'image
dans le sidecar sans jamais faire échouer l'upload lui-même.

#### Scenario: Upload par glisser-déposer

- WHEN l'admin dépose un ou plusieurs fichiers image sur la médiathèque
- THEN chaque fichier DOIT être uploadé puis la liste rafraîchie
- AND les dimensions DOIVENT être enregistrées pour l'affichage

### Requirement: Suppression protégée par un contrôle de référence

`DELETE /api/admin/blog/images/:filename` DOIT, par défaut, refuser (statut
`409`) la suppression d'une image encore référencée par un article — que ce soit
via sa couverture (`coverImageUrl`) ou son contenu (`contentHtml`). La détection
DOIT se faire par **sous-chaîne du nom de fichier**, indépendamment du préfixe
d'URL (relatif en dev, absolu en prod). Le paramètre `?force=true` DOIT
outrepasser ce contrôle.

#### Scenario: Image référencée bloquée

- WHEN l'admin supprime une image utilisée par au moins un article
- THEN le serveur DOIT répondre `409` avec la liste `referencedBy` des articles
- AND l'image NE DOIT PAS être supprimée

#### Scenario: Suppression forcée

- WHEN l'admin renvoie la requête avec `?force=true`
- THEN le serveur DOIT supprimer l'image et son sidecar
- AND enregistrer une entrée d'audit `blog-image.delete`

### Requirement: Sécurité d'accès aux fichiers

Toute route ciblant un fichier image DOIT valider le nom (regex stricte : pas de
dotfile, extension image uniquement ; rejet de `/`, `\`, `..`) **et** confiner le
chemin résolu dans `BLOG_UPLOAD_DIR`
(`resolve(dir,name).startsWith(resolve(dir)+sep)`). Les opérations DOIVENT
utiliser `lstat`/`unlink` (ne pas suivre les symlinks). Le mount
`express.static` du dossier DOIT être configuré `dotfiles: "ignore"` pour ne
jamais servir les sidecars.

#### Scenario: Tentative de path traversal rejetée

- WHEN une requête vise `/images/../etc/passwd` ou un nom non-image
- THEN le serveur DOIT répondre `400` sans accéder au fichier

#### Scenario: Sidecar non servi publiquement

- WHEN un client demande `/images/blog/.<image>.json`
- THEN le serveur statique NE DOIT PAS servir le fichier

### Requirement: Réutilisation d'images via un picker

L'éditeur d'article (TipTap) et le champ de couverture DOIVENT permettre de
choisir une image **existante** depuis la médiathèque, sans la ré-uploader, via
une modale de sélection partagée. La sélection dans l'éditeur DOIT insérer
l'image avec son texte alternatif.

#### Scenario: Insertion depuis la médiathèque dans l'éditeur

- WHEN l'admin ouvre le picker (`📚`) et choisit une image
- THEN l'image DOIT être insérée dans le contenu avec son `src` et son `alt`

#### Scenario: Couverture choisie depuis la médiathèque

- WHEN l'admin ouvre le picker depuis le champ de couverture et choisit une image
- THEN l'URL de couverture DOIT être renseignée avec l'image sélectionnée

### Requirement: Champ de couverture enrichi

Le champ d'image de couverture du formulaire d'article DOIT proposer un aperçu,
un upload (bouton + glisser-déposer), la sélection depuis la médiathèque, un
retrait, et conserver la possibilité de coller une URL manuellement (compat n8n /
images externes).

#### Scenario: Définir puis retirer la couverture

- WHEN l'admin uploade ou choisit une image de couverture
- THEN un aperçu DOIT s'afficher et l'URL DOIT être renseignée
- AND un bouton « Retirer » DOIT permettre de vider la couverture
