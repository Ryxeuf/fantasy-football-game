# competition-blog

## Purpose

Donner à chaque compétition (ligue ou coupe) un blog que ses coachs alimentent
et sur lequel ils réagissent et commentent, lisible exactement par ceux qui
peuvent lire la compétition.

Change d'origine : `competition-blog` (#1087, archivé le 2026-11-15).

## Requirements

### Requirement: Chaque compétition a un blog, ligue comme coupe

Chaque ligue et chaque coupe DOIT disposer d'un blog qui lui est propre. Un
article DOIT être rattaché à exactement une compétition (une ligue OU une
coupe, jamais les deux, jamais aucune). La même mécanique (modèle, service,
routes, composants) DOIT servir les deux familles de compétition. Le blog
d'une ligue DOIT couvrir toutes ses saisons ; un article de ligue DOIT
mémoriser la saison la plus récente au moment de sa publication.

#### Scenario: Article de ligue
- **WHEN** un membre publie un article dans une ligue dont la saison la plus récente est la saison 3
- **THEN** l'article DOIT être rattaché à la ligue et porter la saison 3 comme repère
- **AND** il DOIT rester dans le blog de la ligue quand la saison 4 démarre

#### Scenario: Article de coupe
- **WHEN** un membre publie un article dans une coupe
- **THEN** l'article DOIT être rattaché à la coupe et à aucune ligue

#### Scenario: Deux blogs distincts
- **WHEN** une ligue et une coupe ont chacune des articles
- **THEN** le blog de la ligue NE DOIT PAS lister les articles de la coupe, ni l'inverse

### Requirement: La visibilité du blog est celle de la compétition

Toute lecture du blog (liste, article, commentaires, réactions, images
servies par l'API) DOIT appliquer la règle de visibilité de la compétition,
résolue en un seul endroit pour les ligues et les coupes :

- ligue : la règle existante (publique ; sinon commissaire, admin, coach
  inscrit à une saison, coach invité en attente) ;
- coupe : publique ; sinon commissaire, admin, coach propriétaire d'une
  équipe inscrite, coach invité en attente.

Un lecteur qui ne voit pas la compétition DOIT recevoir un 404, avec le même
message que pour une compétition inexistante. Le blog d'une compétition
publique DOIT se lire sans compte.

#### Scenario: Ligue publique, visiteur anonyme
- **WHEN** un visiteur sans compte ouvre le blog d'une ligue publique
- **THEN** il DOIT voir les articles publiés et leurs commentaires visibles

#### Scenario: Ligue privée, coach étranger
- **WHEN** un coach connecté, ni commissaire, ni inscrit, ni invité, demande le blog ou un article d'une ligue privée
- **THEN** la réponse DOIT être un 404 identique à celui d'une ligue inexistante

#### Scenario: Coupe privée, coach inscrit
- **WHEN** le propriétaire d'une équipe inscrite à une coupe privée ouvre son blog
- **THEN** il DOIT voir les articles publiés

#### Scenario: Coupe privée, visiteur anonyme
- **WHEN** un visiteur sans compte demande le blog d'une coupe privée
- **THEN** la réponse DOIT être un 404

#### Scenario: Compétition devenue privée
- **WHEN** le commissaire passe une ligue publique en privée
- **THEN** son blog DOIT devenir introuvable pour les lecteurs qui ne voient plus la ligue, sans autre action

### Requirement: Seuls les membres écrivent, réagissent et commentent

Sont MEMBRES d'une compétition : son commissaire, et les coachs propriétaires
d'au moins une équipe ENGAGÉE dans l'édition courante (saison de plus grand
numéro pour une ligue, inscription pour une coupe), une inscription retirée ne
comptant pas. Seuls les membres et les admins DOIVENT pouvoir publier un
article, réagir et commenter. Un ancien participant, un coach retiré, un coach
invité ou un lecteur d'une compétition publique DOIVENT pouvoir lire sans
écrire. Le serveur DOIT servir au lecteur ses droits effectifs (écrire,
réagir, commenter, modérer) pour que l'écran n'ait pas à les redéduire.

#### Scenario: Coach inscrit à la saison courante
- **WHEN** un coach dont l'équipe est active dans la saison la plus récente rédige un article
- **THEN** il DOIT pouvoir l'enregistrer et le publier

#### Scenario: Coach d'une saison passée
- **WHEN** un coach n'a joué que la saison 1 d'une ligue publique dont la saison 2 est en cours
- **THEN** il DOIT pouvoir lire le blog
- **AND** toute tentative de publier, réagir ou commenter DOIT être refusée (403)

#### Scenario: Équipe retirée
- **WHEN** l'équipe d'un coach a été retirée de la saison en cours
- **THEN** il NE DOIT PLUS pouvoir publier, réagir ni commenter
- **AND** ses contributions antérieures DOIVENT rester en place

#### Scenario: Commissaire sans équipe
- **WHEN** le commissaire d'une coupe n'y a inscrit aucune équipe
- **THEN** il DOIT pouvoir publier, réagir et commenter

#### Scenario: Lecteur d'une compétition publique
- **WHEN** un coach connecté sans lien avec une ligue publique ouvre un article
- **THEN** il DOIT voir l'article, ses réactions et ses commentaires
- **AND** l'écran NE DOIT PAS lui proposer de réagir ni de commenter

### Requirement: Un article se rédige, se publie et s'épingle

Un article DOIT porter un titre (1 à 120 caractères), un corps en texte riche,
une image de couverture facultative et un statut `draft` ou `published`. Un
brouillon NE DOIT être visible que de son auteur. La première publication DOIT
fixer `publishedAt`, que les publications suivantes NE DOIVENT PAS modifier.
L'auteur DOIT pouvoir modifier son article tant qu'il a le droit d'écrire ; une
modification d'un article publié DOIT être signalée (« modifié le … »). Le
commissaire et l'admin DOIVENT pouvoir épingler un article publié ; la liste
DOIT présenter les articles épinglés d'abord, puis par date de publication
décroissante, paginée.

#### Scenario: Brouillon privé
- **WHEN** un membre enregistre un brouillon
- **THEN** il DOIT le retrouver dans « mes brouillons »
- **AND** aucun autre lecteur, commissaire compris, NE DOIT le voir

#### Scenario: Republication
- **WHEN** un article publié est repassé en brouillon puis republié
- **THEN** sa date de publication DOIT rester celle de la première publication

#### Scenario: Article épinglé
- **WHEN** le commissaire épingle un article ancien
- **THEN** cet article DOIT apparaître en tête du blog, avant les plus récents

### Requirement: Le contenu d'un article est assaini côté serveur

Le corps d'un article DOIT être assaini côté serveur à l'écriture, par une
liste blanche plus stricte que celle du blog du site : pas d'`iframe`, de
`script`, de `style` ni d'attribut d'évènement ; liens `http(s)` et `mailto`
seulement, rendus avec `rel="nofollow ugc noopener"` ; images seulement si leur
source est un upload de la MÊME compétition. Un corps vide après assainissement
ou plus long que la limite DOIT être refusé (400). L'écran DOIT assainir une
seconde fois avant affichage.

#### Scenario: Script injecté
- **WHEN** un membre publie un corps contenant `<script>` ou `onerror=`
- **THEN** l'article enregistré NE DOIT contenir ni l'un ni l'autre

#### Scenario: Image externe
- **WHEN** un corps contient une image pointant vers un domaine tiers ou vers les uploads d'une autre compétition
- **THEN** cette image DOIT être retirée à l'enregistrement

### Requirement: Les images d'un article s'uploadent dans la compétition

Un membre DOIT pouvoir uploader une image pour un article (corps ou
couverture) de sa compétition. L'upload DOIT suivre le patron des uploads du
site : corps binaire brut à taille limitée par le parser (413 au-delà), type
détecté par les octets magiques (JPEG, PNG, WebP, GIF ; 415 sinon), nom de
fichier généré côté serveur et rangé sous un dossier propre à la compétition.
Le nombre d'uploads par auteur et par période DOIT être limité.

#### Scenario: Fichier déguisé
- **WHEN** un membre envoie une archive renommée `photo.jpg`
- **THEN** l'upload DOIT être refusé (415)

#### Scenario: Non-membre
- **WHEN** un lecteur non membre tente un upload sur le blog d'une compétition publique
- **THEN** l'upload DOIT être refusé (403)

### Requirement: Les membres réagissent aux articles par un catalogue fixe

Un membre DOIT pouvoir poser, sur un article publié et non masqué, au plus une
réaction de chaque type du catalogue fixe (`like` 👍, `love` ❤️, `laugh` 😂,
`wow` 😮, `fire` 🔥, `skull` 💀), et la retirer. Poser une réaction déjà posée
ou retirer une réaction absente DOIT être sans effet et sans erreur. Chaque
lecture d'article DOIT servir le compte par type et les types posés par le
lecteur. Un type hors catalogue DOIT être refusé (400).

#### Scenario: Bascule
- **WHEN** un membre clique deux fois sur 🔥 d'un article
- **THEN** sa réaction 🔥 DOIT être posée puis retirée, et le compteur revenir à sa valeur initiale

#### Scenario: Plusieurs types
- **WHEN** un membre pose 😂 et 💀 sur le même article
- **THEN** les deux compteurs DOIVENT augmenter de un

#### Scenario: Double envoi
- **WHEN** deux requêtes simultanées posent la même réaction du même membre
- **THEN** une seule réaction DOIT exister

### Requirement: Les membres commentent les articles

Un membre DOIT pouvoir commenter un article publié et non masqué, en texte brut
de 1 à 2 000 caractères. Les commentaires DOIVENT être servis à plat, du plus
ancien au plus récent, paginés. L'auteur DOIT pouvoir modifier (marque
« modifié ») et supprimer son commentaire ; un commentaire supprimé DOIT
disparaître des lectures. Un commentaire qui correspond à la blocklist DOIT
être masqué automatiquement : visible de son auteur et des modérateurs, avec
la raison, invisible des autres. Le nombre de commentaires par auteur et par
période DOIT être limité (429 au-delà).

#### Scenario: Commentaire d'un membre
- **WHEN** un membre commente un article
- **THEN** le commentaire DOIT apparaître à la suite des précédents pour tout lecteur de l'article

#### Scenario: Commentaire bloqué
- **WHEN** un commentaire contient un terme de la blocklist
- **THEN** il DOIT être enregistré masqué
- **AND** seul son auteur, le commissaire et les admins DOIVENT le voir, marqué comme masqué

#### Scenario: Article en brouillon
- **WHEN** un membre tente de commenter un brouillon
- **THEN** la réponse DOIT être un 404

### Requirement: Le commissaire modère le blog de sa compétition

Le commissaire DOIT pouvoir, sur le blog de SA compétition, masquer et
rétablir un article ou un commentaire (avec une raison), épingler ou désépingler
un article, et supprimer un article ou un commentaire. L'admin DOIT disposer des
mêmes actions sur tous les blogs. Un contenu masqué DOIT rester visible de son
auteur et des modérateurs, avec la raison, et invisible des autres lecteurs.
Chaque masquage DOIT mémoriser son auteur et sa date. Un commissaire NE DOIT
PAS pouvoir modérer le blog d'une compétition qu'il ne dirige pas.

#### Scenario: Masquage d'un article
- **WHEN** le commissaire masque un article avec la raison « hors sujet »
- **THEN** l'article DOIT disparaître de la liste des autres lecteurs
- **AND** son auteur DOIT encore le voir, marqué masqué avec la raison

#### Scenario: Commissaire d'une autre compétition
- **WHEN** le commissaire d'une ligue tente de masquer un article d'une autre ligue
- **THEN** la réponse DOIT être un 403 (ou un 404 si la ligue lui est invisible)

### Requirement: Le blog suit le cycle de vie de la compétition

Le blog d'une compétition archivée DOIT passer en lecture seule : aucune
publication, modification, réaction ni commentaire, la modération restant
possible. La suppression d'une compétition DOIT supprimer son blog (articles,
réactions, commentaires). La suppression d'un compte NE DOIT PAS supprimer ses
articles ni ses commentaires : ils DOIVENT rester affichés sans auteur
identifiable ; ses réactions DOIVENT disparaître.

#### Scenario: Ligue archivée
- **WHEN** une ligue est archivée
- **THEN** son blog DOIT rester lisible selon la visibilité de la ligue
- **AND** toute tentative de publier, réagir ou commenter DOIT être refusée (409)

#### Scenario: Coupe supprimée
- **WHEN** le commissaire supprime une coupe
- **THEN** tous les articles, réactions et commentaires de son blog DOIVENT être supprimés

#### Scenario: Compte supprimé
- **WHEN** l'auteur d'un article supprime son compte
- **THEN** l'article DOIT rester lisible, signé « coach supprimé »

### Requirement: Les publications et les commentaires notifient sans bloquer

La publication d'un article DOIT créer une notification interne pour chaque
membre de la compétition autre que l'auteur, une seule fois par article même
s'il est republié. Un commentaire DOIT notifier l'auteur de l'article (sauf
s'il commente son propre article), sans créer de seconde notification non lue
pour le même article. L'échec d'une notification NE DOIT JAMAIS faire échouer
la publication ou le commentaire. Les notifications DOIVENT pointer vers
l'article.

#### Scenario: Première publication
- **WHEN** un membre publie un article dans une ligue de huit coachs
- **THEN** les sept autres membres DOIVENT recevoir une notification menant à l'article

#### Scenario: Republication
- **WHEN** l'article est repassé en brouillon puis republié
- **THEN** aucune nouvelle notification de publication NE DOIT partir

#### Scenario: Rafale de commentaires
- **WHEN** trois membres commentent l'article avant que son auteur n'ait lu la première notification
- **THEN** l'auteur NE DOIT avoir qu'une notification non lue pour cet article

### Requirement: Le blog s'affiche depuis la fiche de la compétition

La fiche d'une ligue et celle d'une coupe DOIVENT présenter un bloc « Blog »
listant les trois derniers articles visibles du lecteur et un lien vers le
blog complet, ainsi qu'un bouton de rédaction pour les membres. Les pages du
blog (liste, article, rédaction) DOIVENT exister sous la fiche de chaque
famille de compétition et être servies par des composants communs. Les pages
du blog DOIVENT être marquées `noindex`.

#### Scenario: Fiche de ligue
- **WHEN** un lecteur ouvre la fiche d'une ligue qui a des articles
- **THEN** il DOIT voir les trois derniers et un lien « Tout le blog »

#### Scenario: Bouton de rédaction
- **WHEN** un non-membre ouvre la fiche d'une ligue publique
- **THEN** le bouton « Écrire un article » NE DOIT PAS apparaître

### Requirement: Le blog est derrière un flag de déploiement

Toutes les routes du blog de compétition DOIVENT être gatées par le flag
`competition_blog`, déclaré comme flag NORMAL (pas kill-switch), absent ou
éteint par défaut en production et allumé par les seeds de test. Flag éteint,
les routes DOIVENT répondre comme une fonctionnalité indisponible et l'écran NE
DOIT afficher ni bloc ni lien vers le blog.

#### Scenario: Flag éteint
- **WHEN** le flag `competition_blog` est éteint pour un coach
- **THEN** la fiche de ligue NE DOIT PAS afficher le bloc Blog
- **AND** les routes du blog NE DOIVENT servir aucun contenu
