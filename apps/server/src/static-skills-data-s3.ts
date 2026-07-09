/**
 * Données spécifiques des compétences pour la Saison 3 (Blood Bowl 2025)
 * Source: https://mordorbihan.fr/fr/bloodbowl/2025/competences
 *
 * Ce fichier contient :
 * - Les nouvelles compétences de la Saison 3
 * - Les modifications de catégories pour les compétences existantes
 * - Les compétences "Elite" identifiées
 */

export interface Season3SkillData {
  slug: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string;
  category: string;
  isElite?: boolean;
  isPassive?: boolean;
  isNew?: boolean; // Nouvelle compétence (n'existe pas en S2)
}

/**
 * Compétences qui changent de catégorie en Saison 3
 * Ces compétences passent à la catégorie "Scélérates"
 */
export const SEASON_3_CATEGORY_CHANGES: Record<string, string> = {
  "shadowing": "Scélérates",        // Poursuite -> Scélérates
  "sneaky-git": "Scélérates",       // Sournois -> Scélérates
  "dirty-player-1": "Scélérates",   // Joueur Déloyal (+1) -> Scélérates
  "dirty-player-2": "Scélérates",   // Joueur Déloyal (+2) -> Scélérates
  "pile-driver": "Scélérates",      // Marteau-Pilon -> Scélérates
  "fumblerooskie": "Scélérates",    // Fumblerooskie -> Scélérates
  "hit-and-run": "Agility",         // A4/A15 — Frappe-et-court : Trait -> Compétence d'Agilité en S3
  // p.121 (tableau de compétences aléatoires) : Provocation est Générale et
  // Dégagement une compétence de Passe en S3 (sinon le contrôle d'accès au
  // level-up les rejetterait alors qu'elles sont tirables/choisissables).
  "provocation": "General",         // Provocation -> Générales
  "clearance": "Passing",           // Dégagement -> Passe
};

/**
 * Compétences Elite en Saison 3
 * Ces compétences ont le statut "Elite" qui ajoute +10,000 à la valeur d'équipe
 */
export const SEASON_3_ELITE_SKILLS: string[] = [
  "block",        // Blocage
  "dodge",        // Esquive
  "mighty-blow",   // Châtaigne (ancienne version)
  "mighty-blow-1", // Châtaigne (+1)
  "mighty-blow-2", // Châtaigne (+2)
  "guard",        // Garde
];

/**
 * Nouvelles compétences de la Saison 3
 * 
 * NOTE: Cette liste est maintenant vide car toutes les nouvelles compétences S3
 * sont définies directement dans packages/game-engine/src/skills/index.ts
 * avec le flag `season3Only: true`.
 * 
 * Ce fichier est conservé pour :
 * - SEASON_3_CATEGORY_CHANGES : changements de catégorie pour les compétences existantes
 * - SEASON_3_ELITE_SKILLS : liste des compétences Elite en S3
 * - SEASON_3_RENAMED_SKILLS : compétences renommées en S3
 */
export const SEASON_3_NEW_SKILLS: Season3SkillData[] = [];

/**
 * Compétences qui ont été modifiées/renommées en Saison 3
 * (avec un nom anglais différent de Mordorbihan)
 */
export const SEASON_3_RENAMED_SKILLS: Record<string, { nameEn: string; nameFr?: string }> = {
  "big-hand": { nameEn: "Big Hand", nameFr: "Main Démesurée" }, // Grande Main -> Main Démesurée
  "foul-appearance": { nameEn: "Foul Appearance", nameFr: "Répulsion" }, // Apparence Répugnante -> Répulsion
  "no-hands": { nameEn: "No Ball", nameFr: "Sans Ballon" }, // Pas de Mains -> Sans Ballon
  // Renommages FR manquants : le legacy static-skills-data.ts conservait les
  // anciens noms S2, qui gagnaient sur le canon au seed. Le canon
  // (game-engine/skills/index.ts) porte déjà le bon nom ; on l'applique au
  // seed S3 via ce mapping (S2 garde volontairement les anciens noms).
  "pogo-stick": { nameEn: "Pogo Stick", nameFr: "Monté sur Ressort" }, // ex « Échasse à ressort » (A24)
  "pick-me-up": { nameEn: "Pick-me-up", nameFr: "Petit Remontant" },    // ex « Choppe-moi » (A25)
  "drunkard": { nameEn: "Drunkard", nameFr: "Ivrogne*" },              // ex « Poivrot » (A26)
  "breathe-fire": { nameEn: "Breathe Fire", nameFr: "Souffle Ardent" }, // ex « Cracheur de feu » (A14)
  "hit-and-run": { nameEn: "Hit and Run", nameFr: "Frappe-et-court" },  // ex « Frappe et Cours » (A4/A15)
};

/**
 * Descriptions canoniques Saison 3 issues de la retranscription OCR officielle
 * (voir `docs/reference/extraction_blood_bowl.md`,
 * `docs/reference/extraction_competences_blood_bowl.md` et
 * `docs/reference/extraction_competences_traits_blood_bowl.md`).
 *
 * Ce mapping s'applique UNIQUEMENT au seed `season_3` : on conserve les
 * descriptions historiques pour `season_2` (qui peut diverger sur certaines
 * mécaniques). Le slug est la clé.
 *
 * Les entrées concernent en priorité les Compétences/Traits dont la description
 * S3 a été clarifiée par rapport à la S2 ou dont le texte historique en base
 * était trop succinct.
 */
export const SEASON_3_SKILL_DESCRIPTIONS: Record<
  string,
  { description: string; descriptionEn?: string }
> = {
  // Traits dont la description en base était stub/trop courte → OCR S3 officielle
  chainsaw: {
    description:
      "Quand on active ce joueur, il peut annoncer une Action Spéciale d'Attaque de Tronçonneuse ; il n'y a pas de limite au nombre de joueurs qui peuvent annoncer cette Action Spéciale à chaque Tour. Jetez un D6 : sur 2+, ce joueur peut immédiatement faire un Jet d'Armure contre 1 joueur adverse Debout en appliquant un modificateur de +3. Sur un 1, la Tronçonneuse Dérape et ce joueur est Plaqué. Si ce joueur est Plaqué ou Chute pour toute raison, on applique un modificateur de +3 quand le Coach adverse fait un Jet d'Armure pour lui (toujours obligatoire). S'il le souhaite, ce joueur peut aussi utiliser sa Tronçonneuse lors d'une Action d'Agression : +3 au Jet d'Armure du joueur adverse, avec le risque de Dérapage. Cette Action Spéciale peut remplacer l'Action de Blocage d'un Blitz ; l'activation prend fin sitôt qu'elle est effectuée.",
    descriptionEn:
      "When activated, this player may declare a Chainsaw Attack Special Action (no per-turn limit). Roll a D6: on 2+, immediately make an Armour Roll against an adjacent Standing opposing player with a +3 modifier. On a 1, the Chainsaw Slips and this player is Knocked Down instead. If this player is Knocked Down or Falls Over for any reason, the opposing coach applies a mandatory +3 modifier to the Armour Roll. The Chainsaw may also be used during a Foul Action: +3 to the opponent's Armour Roll, still subject to a Slip check. The Special Action may replace the Block of a Blitz; the activation ends as soon as it is performed.",
  },
  "ball-and-chain": {
    description:
      "Quand on active ce joueur, la seule action qu'il peut annoncer est une Action Spéciale de Chaîne et Boulet (pas de limite par tour). Placez le Gabarit de Renvoi sur ce joueur, choisissez une orientation, jetez un D6 et déplacez-le sur la case indiquée. Il n'a pas à faire de Test d'Esquive et personne ne peut utiliser Poursuite ni Tentacules contre lui. Sortie de terrain = risque d'être Blessé par le Public. Case d'un joueur Debout = Action de Blocage automatique (ignore Répulsion ; sur un coéquipier, le Coach choisit le résultat). Case d'un joueur À Terre ou Sonné = Repoussé + Jet d'Armure. Case contenant le ballon = Rebond (sans Turnover). Il peut Foncer ; sur un 1 il se déplace puis Chute. Si ce joueur Chute pour toute raison, faites immédiatement un Jet de Blessure en traitant tout Sonné comme K.-O. Incompatible avec : Tacle Plongeant, Fourchette, Frénésie, Projection, Frappe-et-court, Saut, Blocage Multiple, Sur le Ballon, Poursuite, Appuis Sûrs.",
    descriptionEn:
      "When activated, the only action this player may declare is a Ball and Chain Special Action (no per-turn limit). Place the Throw-in Template on this player, choose a direction, roll a D6 and move them to the indicated square. They auto-pass any Dodge test and cannot be targeted by Shadowing or Tentacles. Off the pitch: risk Crowd Surf. Standing player: automatic Block (ignores Foul Appearance; on a teammate the coach picks the result). Prone/Stunned player: Push Back + Armour Roll. Ball square: Bounce (no Turnover). May GFI; on a 1, move first then Fall Over. If they Fall Over for any reason, immediately roll Injury treating any Stunned result as KO. Incompatible with: Diving Tackle, Fork, Frenzy, Grab, Hit and Run, Leap, Multiple Block, On the Ball, Shadowing, Surefoot.",
  },
  "hypnotic-gaze": {
    description:
      "Quand on active ce joueur, il peut annoncer une Action Spéciale de Regard Hypnotique (pas de limite par tour). Il a d'abord le droit de faire une Action de Mouvement, mais ne peut plus se déplacer après l'Action Spéciale. Choisissez un joueur adverse Debout adjacent et jetez un D6. Sur 1-2, rien ne se passe et l'activation prend fin. Sur 3+, le joueur adverse choisi devient Déconcentré et l'activation prend fin.",
    descriptionEn:
      "When activated, this player may declare a Hypnotic Gaze Special Action (no per-turn limit). They may first perform a Move Action, but cannot keep moving afterwards. Choose an adjacent Standing opposing player and roll a D6. On 1-2, nothing happens and the activation ends. On 3+, the target becomes Stunned/Hypnotised and the activation ends.",
  },
  decay: {
    description:
      "Appliquez un modificateur de +1 à tout Jet d'Élimination fait contre ce joueur.",
    descriptionEn:
      "Apply a +1 modifier to any Casualty roll made against this player.",
  },
  stab: {
    description:
      "Quand on active ce joueur, il peut annoncer une Action Spéciale de Poignard (pas de limite par tour). Choisissez un joueur adverse Debout adjacent et faites un Jet d'Armure non modifiable. Si l'armure est pénétrée, faites un Jet de Blessure pour lui ; sinon rien ne se passe. Cette Action Spéciale peut remplacer l'Action de Blocage d'un Blitz ; l'activation prend fin sitôt qu'elle est effectuée.",
    descriptionEn:
      "When activated, this player may declare a Stab Special Action (no per-turn limit). Choose an adjacent Standing opposing player and make an unmodifiable Armour Roll. If the armour is broken, make an Injury Roll; otherwise nothing happens. This Special Action may replace the Block of a Blitz; the activation ends as soon as it is performed.",
  },
  // Traits S3-only (déjà décrits proprement dans SKILLS_DEFINITIONS, mais on
  // garantit ici la version OCR officielle pour le seed S3 même si la base
  // contient une ancienne version.)
  trickster: {
    description:
      "Chaque fois qu'un joueur adverse tente d'effectuer une Action de Blocage contre ce joueur, ou une Action Spéciale qui cible directement ce joueur (à l'exception d'une Action de Blocage causée par Chaîne et Boulet), ce joueur peut utiliser ce Trait. Avant de déterminer combien de dés on jette, ce joueur peut être retiré du terrain et placé sur n'importe quelle autre case inoccupée adjacente au joueur effectuant l'action. L'action se déroule ensuite normalement.",
    descriptionEn:
      "Whenever an opposing player attempts a Block action against this player, or a Special action targeting them directly (except a Block triggered by Ball and Chain), this player may use this Trait. Before deciding how many dice to roll, this player may be removed from the pitch and placed on any other unoccupied square adjacent to the player performing the action. The action then proceeds normally.",
  },
  hate: {
    description:
      "Chaque fois que ce joueur effectue une Action de Blocage contre un joueur ayant le même Mot-clé que celui entre parenthèses, ce joueur peut relancer un résultat Attaquant Plaqué.",
    descriptionEn:
      "Each time this player performs a Block action against a player with the same Keyword as the one in parentheses, this player may re-roll an Attacker Down result.",
  },
  // A21 — Prendre Racine : le jet n'a lieu que si le joueur est Debout (texte S3
  // officiel, cf. extraction_competences_blood_bowl.md). L'ancien texte ne
  // précisait pas la condition « Debout ».
  "take-root": {
    description:
      "Chaque fois qu'on active ce joueur, après avoir annoncé son action, s'il est Debout il doit jeter un D6. Sur 2+, il peut effectuer l'action annoncée normalement. Sur un 1, il ne peut effectuer aucune action et son activation se termine immédiatement.",
    descriptionEn:
      "Each time this player is activated, immediately after declaring their action, if they are Standing they must roll a D6. On 2+, they may perform the declared action as normal. On a 1, they cannot perform any action and their activation ends immediately.",
  },
  // A49 — Rétablissement : le texte S3 précise le coût évité (3 cases) et la
  // conséquence d'un Test d'Agilité raté (reste À Terre, fin d'activation).
  // Reformulé (politique PI), cf. docs/reference/extraction_competences_blood_bowl.md.
  "jump-up": {
    description:
      "Cette Compétence s'utilise quand le joueur est À Terre : il peut alors se relever gratuitement, sans dépenser les 3 cases de mouvement habituelles. Un joueur À Terre ayant cette Compétence peut aussi annoncer une Action de Blocage ; il fait alors un Test d'Agilité en appliquant un modificateur de +1. En cas de réussite, il se relève immédiatement et effectue l'Action de Blocage. En cas d'échec, il reste À Terre et son activation prend fin immédiatement.",
    descriptionEn:
      "This skill is used while the player is Prone: they may stand up for free, without spending the usual 3 squares of movement. A Prone player with this skill may also declare a Block action; they then make an Agility test with a +1 modifier. If passed, they immediately stand up and perform the Block action. If failed, they remain Prone and their activation ends immediately.",
  },
  // A50 — Saut : en S3, on Saute par-dessus UNE case adjacente quel que soit son
  // contenu, résolu comme Bondir avec les modificateurs négatifs réduits de 1
  // (minimum -1) ; incompatible avec Monté sur Ressort.
  leap: {
    description:
      "Pendant son Action de Mouvement, ce joueur peut tenter de Sauter par-dessus une unique case adjacente, quel que soit ce qu'elle contient. Le Saut se résout exactement comme Bondir, à ceci près que ce joueur réduit de 1 les modificateurs négatifs appliqués à son Test d'Agilité de Saut, sans pouvoir aller en dessous de -1. Un joueur ayant cette Compétence ne peut pas avoir aussi le Trait Monté sur Ressort.",
    descriptionEn:
      "During their Move action, this player may attempt to Jump over a single adjacent square, regardless of what it contains. The Jump is resolved exactly like Leaping over a player, except this player reduces any negative modifiers to the Jump's Agility test by 1, to a minimum of -1. A player with this skill cannot also have the Pogo Stick trait.",
  },
  // A51 — Sprint : le texte S3 dit « une fois de plus que la normale » (et non
  // « trois fois plutôt que deux »), pour composer avec d'autres effets.
  sprint: {
    description:
      "Quand ce joueur effectue une Action de Mouvement, il peut tenter de Foncer une fois de plus que le nombre de tentatives auxquelles il a normalement droit.",
    descriptionEn:
      "When this player performs a Move action, they may attempt to Rush one more time than the number of attempts they are normally allowed.",
  },
  // A52 — Frappe Précise : en S3 la Déviation du coup d'envoi passe à D3 cases
  // (au choix du Coach) au lieu de D6 — plus de division par deux arrondie.
  kick: {
    description:
      "Quand ce joueur est désigné pour effectuer le coup d'envoi, son Coach peut décider, au moment où le ballon Dévie, que la Déviation ne soit que de D3 cases au lieu de D6.",
    descriptionEn:
      "When this player is nominated to take the kick-off, their coach may decide, when the ball Deviates, that it only Deviates D3 squares instead of D6.",
  },
  insignifiant: {
    description:
      "Quand vous créez une Liste d'Équipe, vous ne pouvez pas inclure plus de joueurs ayant ce Trait que de joueurs n'ayant pas ce Trait.",
    descriptionEn:
      "When you create a roster, you cannot include more players with this Trait than players without it.",
  },
  contagieux: {
    description:
      "Une fois par match, quand un joueur ayant ce Trait inflige une Élimination à un joueur adverse suite à une Action de Blocage et que celui-ci subit un résultat Mort sur son Jet d'Élimination, s'il n'est pas sauvé par un Apothicaire, vous pouvez immédiatement ajouter 1 nouveau joueur Trois-quart de votre Fiche d'Équipe à votre Box des Réserves (cela peut amener votre équipe à compter plus de 16 joueurs pour le restant du match). Pendant la Séquence d'Après Match, vous pouvez embaucher ce joueur de la même manière qu'un Joueur Journalier. Inutilisable contre les Gros Bras, ni contre un joueur ayant les Traits Décomposition, Régénération ou Minus.",
    descriptionEn:
      "Once per match, when a player with this Trait inflicts a Casualty on an opposing player as the result of a Block action and that player suffers a Dead result on their Casualty roll, if they are not saved by an Apothecary, you may immediately add 1 new Lineman from your roster to your Reserves Box (this may temporarily exceed 16 players for the rest of the match). During the Post-Game Sequence, you may permanently hire this player like a Journeyman. Cannot be used against Big Guys, nor against a player with Decay, Regeneration or Titchy.",
  },
  instable: {
    description:
      "Ce joueur ne peut pas déclarer d'Action de Sécurisation du Ballon.",
    descriptionEn:
      "This player cannot declare a Secure the Ball action.",
  },
  "breathe-fire": {
    description:
      "Quand on active ce joueur, il peut annoncer une Action Spéciale de Souffle Ardent (pas de limite par tour). Choisissez un joueur adverse Debout que ce joueur Marque et jetez un D6, en appliquant un modificateur de -1 si la cible a une Force de 5 ou plus. Sur un 1, ce joueur est Plaqué. Sur 2-3, rien ne se passe. Sur 4+, le joueur adverse est Mis À Terre. Sur un 6 naturel, il est Plaqué à la place. L'Action Spéciale peut remplacer le Bloc d'un Blitz ; l'activation prend fin sitôt qu'elle est effectuée.",
    descriptionEn:
      "When activated, this player may declare a Breathe Fire Special Action (no per-turn limit). Choose an adjacent Standing opposing player they Mark and roll a D6 (apply a -1 modifier if the target has Strength 5+). On a 1, this player is Knocked Down. On 2-3, nothing happens. On 4+, the target is Placed Prone. On a natural 6, the target is Knocked Down instead. The Special Action may replace the Block of a Blitz; the activation ends after it.",
  },
  "my-ball": {
    description:
      "Un joueur ayant ce Trait ne peut pas abandonner volontairement le ballon quand il en est en possession, et ne peut donc pas déclarer d'Actions de Passe ni de Transmission, ni utiliser la moindre Compétence ou Trait qui l'autoriserait à renoncer à la possession du ballon.",
    descriptionEn:
      "A player with this Trait cannot voluntarily give up the ball while they have possession, and therefore cannot declare Pass or Hand-off actions, nor use any Skill or Trait that would let them relinquish possession.",
  },
  "pick-me-up": {
    description:
      "À la fin de chaque Tour adverse, jetez un D6 pour chaque coéquipier À Terre à 3 cases ou moins d'un ou plusieurs joueurs Debout ayant ce Trait. Sur 5+, le joueur À Terre peut immédiatement se relever. Si un joueur ayant ce Trait se relève suite à un coéquipier utilisant ce Trait, il ne peut pas aussi utiliser ce Trait pendant le même Tour.",
    descriptionEn:
      "At the end of each opposing turn, roll a D6 for each Prone teammate within 3 squares of one or more Standing players with this Trait. On 5+, the Prone player may immediately stand up. A player who stood up via another teammate's use of this Trait cannot themselves use this Trait during the same turn.",
  },
  "hit-and-run": {
    description:
      "Quand un joueur ayant cette Compétence effectue une Action de Blocage ou une Action Spéciale de Poignard, après avoir entièrement résolu l'Action avec succès, il peut immédiatement se déplacer de 1 case gratuitement en ignorant les Zones de Tacle, tant qu'il est toujours Debout. Le joueur doit s'assurer qu'après ce mouvement gratuit, il ne Marque ni n'est Marqué par aucun joueur adverse. Incompatible avec Frénésie.",
    descriptionEn:
      "When a player with this Skill performs a Block action or a Stab Special Action and fully resolves it successfully, they may immediately move 1 square for free, ignoring Tackle Zones, as long as they are still Standing. After this free move, they must not be Marking nor Marked by any opposing player. Incompatible with Frenzy.",
  },
  // Traits S3 issus de l'OCR avec descriptions canoniques
  "wild-animal": {
    description:
      "Chaque fois qu'on active ce joueur, après avoir annoncé son action, il doit jeter un D6. Il peut appliquer un modificateur de +2 au jet s'il a annoncé une Action de Blocage ou une Action de Blitz. Sur 4+, le joueur peut effectuer l'action annoncée normalement. Sur un 1-3, ce joueur plonge dans une rage incohérente, mais rien ne se produit vraiment. Son activation prend immédiatement fin.",
    descriptionEn:
      "Each time this player is activated, after announcing their action, roll a D6. Apply a +2 modifier if they announced a Block or Blitz action. On 4+, they perform the announced action normally. On 1-3, the player dives into incoherent rage but nothing actually happens. Their activation ends immediately.",
  },
  "animal-savagery": {
    description:
      "Chaque fois qu'on active ce joueur, après avoir annoncé son action, il doit jeter un D6. Il peut appliquer un modificateur de +2 au jet s'il a annoncé une Action de Blocage ou une Action de Blitz. Sur 4+, le joueur peut effectuer l'action annoncée normalement. Sur un 1-3, ce joueur se déchaîne sur un de ses coéquipiers : choisissez 1 coéquipier Debout adjacent ; il est immédiatement Plaqué (sans Turnover sauf s'il était porteur du ballon). Si le joueur a Griffes ou Châtaigne, il doit les utiliser. S'il n'y a pas de coéquipier Debout adjacent sur 1-3, le joueur devient Déconcentré.",
    descriptionEn:
      "Each time this player is activated, after announcing their action, roll a D6. Apply a +2 modifier if they announced a Block or Blitz action. On 4+, they perform the announced action normally. On 1-3, the player lashes out at a teammate: choose 1 adjacent Standing teammate; they are immediately Knocked Down (no Turnover unless they were ball carrier). If this player has Claws or Mighty Blow, they must apply them. If there is no adjacent Standing teammate on 1-3, the player becomes Stunned/Distracted.",
  },
  "no-hands": {
    description:
      "Un joueur ayant ce Trait ne peut jamais être en possession du ballon. Si ce joueur est censé tenter de Réceptionner ou Ramasser le ballon, il rate automatiquement comme s'il avait obtenu un 1 naturel. Un joueur ayant ce Trait ne peut pas tenter d'Intercepter une Passe.",
    descriptionEn:
      "A player with this Trait can never be in possession of the ball. If this player would attempt to Catch or Pick Up the ball, they automatically fail as if they rolled a natural 1. A player with this Trait cannot attempt to Intercept a Pass.",
  },
  "secret-weapon": {
    description:
      "À la fin d'une Phase lors de laquelle ce joueur a participé, même s'il n'est pas sur le terrain à la fin de la Phase, il est Expulsé pour avoir commis une Agression.",
    descriptionEn:
      "At the end of any Drive in which this player took part, even if they are not on the pitch at the end of the Drive, they are Sent Off for committing a Foul.",
  },
  "always-hungry": {
    description:
      "Chaque fois que ce joueur effectue une Action de Lancer de Coéquipier, avant de faire le Test de Capacité de Passe, il doit jeter un D6. Sur 2+, il continue normalement. Sur un 1, il tente de manger son coéquipier : il jette un autre D6. Sur 2+, le coéquipier s'échappe et l'Action de Lancer est résolue automatiquement en Maladresse sur Lancer. Sur un 1, il mange son coéquipier : retirez immédiatement celui-ci de la Liste d'Équipe (pas d'Apothicaire ni de Régénération). Si le coéquipier était porteur du ballon, celui-ci Rebondit depuis la case du Toujours Affamé. Un Turnover s'ensuit.",
    descriptionEn:
      "Each time this player performs a Throw Team-mate action, before the Passing Ability test, they must roll a D6. On 2+, they continue normally. On a 1, they try to eat the teammate: roll another D6. On 2+, the teammate escapes and the Throw Team-mate action automatically results in a Fumble. On a 1, the player eats the teammate: remove them immediately from the roster (no Apothecary, no Regeneration). If the eaten teammate held the ball, it Bounces from the Always Hungry player's square. A Turnover follows.",
  },
  bombardier: {
    description:
      "Quand on active ce joueur, il peut annoncer une Action Spéciale de Lancer de Bombe ; un seul joueur par Tour peut annoncer cette Action Spéciale. Le lancer suit toutes les règles d'une Action de Passe (sauf Sur le Ballon). Une bombe explose dès qu'elle s'immobilise au sol, ou immédiatement sur Maladresse / Réception ratée. Sur la case d'explosion : tout joueur subit l'effet ; sur 4+, chaque joueur adjacent est aussi touché. Tout joueur Debout touché est Plaqué ; pour À Terre/Sonné, faites un Jet d'Armure. Une bombe Réceptionnée ou Interceptée doit être relancée immédiatement.",
    descriptionEn:
      "When activated, this player may declare a Throw Bomb Special Action; only one player per turn may declare it. Throwing follows all Pass action rules (except On the Ball). A bomb explodes the moment it comes to rest on the ground, or immediately on a Fumble / failed Catch. On the explosion square, any player is hit; for adjacent squares, roll D6 — on 4+ they're hit too. Standing players hit are Knocked Down; Prone/Stunned players hit get an Armour Roll. A successfully caught or intercepted bomb must immediately be re-thrown.",
  },
  "kick-team-mate": {
    description:
      "Quand on active ce joueur, il peut annoncer une Action Spéciale de Botter de Coéquipier ; un seul joueur par Tour peut annoncer cette Action Spéciale. Fonctionne comme une Action de Lancer de Coéquipier, sauf qu'elle ne compte pas comme l'Action Lancer de Coéquipier d'équipe pour le tour. Sur Maladresse, faites immédiatement un Jet de Blessure pour le coéquipier botté en traitant tout Sonné comme K.-O. ; si le botté portait le ballon, il Rebondit. Toute Compétence/Trait s'appliquant au Lancer de Coéquipier s'applique aussi ici, et les PSP sont gagnés de la même manière.",
    descriptionEn:
      "When activated, this player may declare a Kick Team-mate Special Action; only one player per turn may declare it. It works exactly like a Throw Team-mate action except it does not count as the team's Throw Team-mate action for the turn. On a Fumble, immediately roll Injury for the kicked teammate treating Stunned as KO; if they held the ball, it Bounces. Skills/Traits that trigger on Throw Team-mate also apply here, and SPP are gained the same way.",
  },
  "projectile-vomit": {
    description:
      "Quand on active ce joueur, il peut annoncer une Action Spéciale de Gerbe de Vomi (pas de limite par tour). Choisissez un joueur adverse Debout adjacent et jetez un D6. Sur 2+, ce joueur vomit sur sa cible : faites un Jet d'Armure non modifiable. Si l'armure est pénétrée, faites un Jet de Blessure ; sinon rien ne se passe. Sur un 1, le joueur se couvre de bile caustique : Jet d'Armure non modifiable contre lui-même (Jet de Blessure si percée). L'Action Spéciale peut remplacer le Bloc d'un Blitz ; l'activation prend fin sitôt qu'elle est effectuée.",
    descriptionEn:
      "When activated, this player may declare a Projectile Vomit Special Action (no per-turn limit). Choose an adjacent Standing opposing player and roll a D6. On 2+, this player vomits on the target: make an unmodifiable Armour Roll; if it breaks, make an Injury Roll. On a 1, the player covers themselves in caustic bile: unmodifiable Armour Roll against themselves (Injury Roll if it breaks). The Special Action may replace the Block of a Blitz; the activation ends as soon as it is performed.",
  },
  "hail-mary-pass": {
    description:
      "Quand ce joueur effectue une Action de Passe ou une Action Spéciale de Lancer de Bombe, il peut annoncer n'importe quelle case sur le terrain comme case cible au lieu d'utiliser la Réglette. Faites un Test de Capacité de Passe normalement en traitant le lancer comme une Longue Bombe, et traitez tout résultat de Passe Précise comme une Passe Imprécise. On ne peut pas Intercepter une Passe Désespérée.",
    descriptionEn:
      "When this player performs a Pass action or a Throw Bomb Special action, they may declare any square on the pitch as target instead of using the Range Ruler. Make a Passing Ability test as if throwing a Long Bomb, treating any Accurate result as Inaccurate. A Hail Mary Pass cannot be Intercepted.",
  },
  // Compétences S3 (Scélérates) — descriptions OCR canoniques
  "solitary-aggressor": {
    description:
      "Quand ce joueur effectue une Action d'Agression, s'il n'y a aucun joueur fournissant un Soutien Offensif ni Défensif, alors ce joueur peut relancer un Jet d'Armure raté.",
    descriptionEn:
      "When this player performs a Foul action, if no player provides Offensive or Defensive Assist, then this player may re-roll a failed Armour Roll.",
  },
  "lightning-aggression": {
    description:
      "L'activation de ce joueur ne prend pas fin après qu'il a effectué une Action d'Agression, et il peut continuer son Action de Mouvement avec son mouvement restant.",
    descriptionEn:
      "This player's activation does not end after performing a Foul action; they may continue their Move action with any remaining movement.",
  },
  "boot-to-the-head": {
    description:
      "Ce joueur peut fournir un Soutien Offensif quand un coéquipier effectue une Action d'Agression, quel que soit le nombre de joueurs adverses qui Marquent ce joueur.",
    descriptionEn:
      "This player may provide Offensive Assist when a teammate performs a Foul action, regardless of how many opposing players are Marking this player.",
  },
  fork: {
    description:
      "Quand un joueur adverse est Repoussé par ce joueur, le joueur adverse ne peut pas fournir de Soutien Offensif ni Défensif jusqu'à la fin de sa prochaine activation.",
    descriptionEn:
      "When an opposing player is Pushed Back by this player, that opposing player cannot provide Offensive or Defensive Assist until the end of their next activation.",
  },
  "violent-innovator": {
    description:
      "Si un joueur adverse subit une Élimination suite à une Action Spéciale que ce joueur a effectuée, ce joueur gagne les Points de Star Player correspondants pour avoir infligé une Élimination. Un joueur peut avoir cette Compétence seulement s'il a un Trait qui lui permet d'effectuer une Action Spéciale.",
    descriptionEn:
      "If an opposing player suffers a Casualty as a result of a Special action this player performed, this player gains the corresponding SPP for inflicting the Casualty. A player can only have this Skill if they have a Trait that lets them perform a Special action.",
  },
  provocation: {
    description:
      "Quand un joueur ayant cette Compétence est Repoussé suite à une Action de Blocage effectuée contre lui, le Coach de ce joueur peut choisir de forcer le joueur adverse à Poursuivre. On ne peut pas utiliser cette Compétence contre un joueur adverse Enraciné en raison du Trait Prendre Racine.",
    descriptionEn:
      "When a player with this Skill is Pushed Back as the result of a Block action made against them, that player's coach may force the opposing player to Follow Up. This Skill cannot be used against an opposing player who is Rooted due to the Take Root Trait.",
  },
  saboteur: {
    description:
      "Quand ce joueur est Plaqué suite à l'Action de Blocage d'un joueur adverse, avant de faire le Jet d'Armure, il peut jeter un D6. Sur 1-3, rien ne se passe et on fait le Jet d'Armure normalement. Sur 4+, l'arme sabotée explose et le joueur adverse est aussi Plaqué (ne provoque pas de Turnover sauf si l'adversaire était porteur du ballon). Si l'arme explose, ce joueur est automatiquement K.-O. et on ne fait pas de Jet d'Armure pour lui. Un joueur sans le Trait Arme Secrète ne peut pas avoir cette Compétence.",
    descriptionEn:
      "When this player is Knocked Down as a result of an opposing Block action, before the Armour Roll, they may roll a D6. On 1-3, nothing happens and the Armour Roll is made normally. On 4+, the sabotaged weapon explodes and the opposing player is also Knocked Down (no Turnover unless the opponent held the ball). If the weapon explodes, this player is automatically KO'd and no Armour Roll is made for them. A player without the Secret Weapon Trait cannot have this Skill.",
  },
  "fatal-flight": {
    description:
      "Quand ce joueur est lancé dans le cadre d'une Action de Lancer de Coéquipier, s'il atterrit sur une case occupée par un joueur adverse (y compris en Rebondissant) et que le joueur adverse est Plaqué, alors il peut appliquer un modificateur de +1 soit au Jet d'Armure, soit au Jet de Blessure (modificateur appliquable après le jet). Si le joueur adverse subit une Élimination après avoir été Plaqué, ce joueur compte comme l'auteur et reçoit les PSP correspondants. Nécessite le Trait Minus.",
    descriptionEn:
      "When this player is thrown via a Throw Team-mate action, if they land on a square occupied by an opposing player (including via a Bounce) and that player is Knocked Down, they may apply a +1 modifier to either the Armour Roll or the Injury Roll (modifier applied after the roll). If the opposing player suffers a Casualty after being Knocked Down, this player is treated as having caused it and gains the corresponding SPP. Requires the Titchy Trait.",
  },
  clearance: {
    description:
      "Ce joueur peut annoncer une Action Spéciale de Dégagement (1 seul par Tour). Il peut d'abord effectuer une Action de Mouvement, mais ne peut plus se déplacer après l'Action Spéciale. Si après son mouvement il est porteur du ballon, il peut le Dégager : placez le Gabarit de Renvoi, jetez un D6 pour la direction puis un D6 pour la distance. Si Frappe Précise, il peut relancer l'un ou l'autre dé (la direction avant le jet de distance). Si le ballon atterrit sur un joueur, celui-ci tente une Réception, sinon le ballon Rebondit. Aucun Turnover si le ballon s'immobilise au sol ; Turnover si le ballon termine en possession adverse ou dans le public.",
    descriptionEn:
      "This player may declare a Clearance Special Action (max 1 per turn). They may first perform a Move action but cannot continue moving after the Special Action. If they hold the ball after moving, they may Clear it: place the Throw-in Template on them, roll a D6 for direction then another for distance. With the Kick Skill they may re-roll either die (direction must be re-rolled before the distance roll). If the ball lands on a player, that player attempts a Catch; otherwise the ball Bounces. No Turnover if the ball comes to rest on the ground; Turnover if the ball ends up with an opponent or in the crowd.",
  },
  surefoot: {
    description:
      "Chaque fois que ce joueur est censé être Plaqué ou Chute, jetez un D6. Sur un 6, ce joueur n'est pas Plaqué ou ne Chute pas. Si ceci se produit pendant son activation, il peut continuer son activation normalement et aucun Turnover ne s'ensuit.",
    descriptionEn:
      "Each time this player would be Knocked Down or Fall Over, roll a D6. On a 6, this player is not Knocked Down / does not Fall Over. If this happens during their activation, they may continue normally and no Turnover occurs.",
  },
  bullseye: {
    description:
      "Quand ce joueur effectue une Action de Lancer de Coéquipier, si le résultat du lancer est un Lancer Superbe, alors le joueur lancé ne Valdingue pas avant d'atterrir et il atterrit sur la case cible. Un joueur sans le Trait Lancer de Coéquipier ne peut pas avoir cette Compétence.",
    descriptionEn:
      "When this player performs a Throw Team-mate action, if the throw is an Excellent Throw, the thrown player does not Wobble before landing and lands on the target square. A player without the Throw Team-mate Trait cannot have this Skill.",
  },
  "running-pass-2025": {
    description:
      "Si ce joueur effectue une Action de Passe qui est une Passe Rapide, ou effectue une Action de Transmission, alors, tant qu'il n'y a pas eu de Turnover, son activation ne prend pas fin une fois la Passe ou la Transmission résolue. À la place, il peut continuer son Action de Mouvement en utilisant son mouvement restant.",
    descriptionEn:
      "If this player performs a Pass action that is a Quick Pass, or a Hand-off action, and provided no Turnover occurs, their activation does not end once the Pass or Hand-off is resolved. Instead, they may continue their Move action using their remaining movement.",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Compétences / Mutations dont la description a CHANGÉ en Saison 3
  // Source : docs/reference/extraction_competences_blood_bowl.md (OCR officiel S3)
  // ─────────────────────────────────────────────────────────────────────────

  // Catégorie Agilité
  defensive: {
    description:
      "Pendant les Tours adverses, les joueurs adverses que ce joueur Marque ne peuvent pas utiliser les Compétences Garde ni Coup de Crampons.",
    descriptionEn:
      "During your opponent's team turns, any opposing players being Marked by this player cannot use the Guard or Boot to the Head Skills.",
  },
  dodge: {
    description:
      "Une fois par Tour, ce joueur peut relancer un unique Test d'Agilité quand il tente d'Esquiver. De plus, cette Compétence affecte le résultat Bousculé quand un joueur adverse effectue une Action de Blocage contre ce joueur, comme décrit en page 62.",
    descriptionEn:
      "Once per turn, this player may re-roll a single Agility test when attempting to Dodge. In addition, this Skill affects the Stumble result when an opposing player performs a Block action against this player, as described on page 62.",
  },
  "diving-catch": {
    description:
      "Ce joueur peut tenter de Réceptionner le ballon s'il atterrit sur une case dans sa Zone de Tacle suite à une Passe, un Renvoi ou un Coup d'Envoi. Il ne peut pas utiliser cette Compétence pour tenter de Réceptionner le ballon s'il atterrit sur une case dans sa Zone de Tacle suite à un Rebond. De plus, ce joueur peut appliquer un modificateur de +1 à ses Test d'Agilité quand il tente de Réceptionner le ballon dans le cadre d'une Action de Passe s'il est sur la case cible.",
    descriptionEn:
      "This player may attempt to Catch the ball if it lands in a square in their Tackle Zone from a Pass, Kick-off, or Throw-in. They cannot use this Skill to Catch a ball that Bounces into their Tackle Zone. In addition, this player may apply a +1 modifier to their Agility test when attempting to Catch the ball from a Pass action if they occupy the target square.",
  },
  "diving-tackle": {
    description:
      "Quand un joueur adverse tente de quitter la Zone de Tacle de ce joueur suite à une Esquive, un Saut ou un Bond, après avoir fait le Test d'Agilité et appliqué les modificateurs et relances éventuelles, ce joueur peut utiliser cette Compétence. Appliquez immédiatement un modificateur de -2 au Test d'Agilité du joueur adverse et placez ce joueur À Terre sur la case que le joueur adverse a quitté. Si un joueur tente de quitter la Zone de Tacle de plusieurs joueurs ayant cette Compétence en même temps, un seul de ces joueurs peut utiliser cette Compétence.",
    descriptionEn:
      "When an opposing player attempts to leave this player's Tackle Zone via a Dodge, Jump, or Leap, after making the Agility test and applying any modifiers and re-rolls, this player may use this Skill. Immediately apply a -2 modifier to the opposing player's Agility test and place this player Prone on the square the opposing player vacated. If a player tries to leave the Tackle Zone of multiple players with this Skill simultaneously, only one may use this Skill.",
  },
  "safe-pair-of-hands": {
    description:
      "Si ce joueur est Plaqué, Chute ou est Mis À Terre alors qu'il est en possession du ballon, alors avant qu'il soit À Terre, il peut placer le ballon sur n'importe quelle case inoccupée adjacente à celle où il se retrouve À Terre au lieu que le ballon Rebondisse normalement.",
    descriptionEn:
      "If this player is Knocked Down, Falls Over, or is Placed Prone while in possession of the ball, before they are placed Prone, they may place the ball on any unoccupied square adjacent to the square where they end up Prone instead of the ball Bouncing normally.",
  },

  // Catégorie Générale
  catch: {
    description:
      "Ce joueur peut relancer tout Test d'Agilité raté quand il tente de Réceptionner le ballon.",
    descriptionEn:
      "This player may re-roll any failed Agility test when attempting to Catch the ball.",
  },
  dauntless: {
    description:
      "Quand ce joueur ayant cette Compétence effectue une Action de Blocage contre un joueur adverse qui a une Caractéristique de Force supérieure (avant d'appliquer des modificateurs aux deux joueurs), ce joueur peut jeter un D6 et ajouter sa propre Caractéristique de Force. Si le résultat est supérieur à la Caractéristique de Force non modifiée du joueur adverse, alors ce joueur augmente sa Caractéristique de Force non modifiée pour qu'elle soit égale à celle du joueur adverse pour la durée de l'Action de Blocage. Puis on applique les modificateurs normalement. Si ce joueur a aussi une Compétence qui l'autorise à effectuer plusieurs Actions de Blocage, comme la Compétence Frénésie, alors il doit faire un jet séparé pour chaque Action de Blocage.",
    descriptionEn:
      "When this player performs a Block action against an opposing player that has a higher Strength characteristic (before applying modifiers to either player), this player may roll a D6 and add their own Strength characteristic. If the result exceeds the opposing player's unmodified Strength, this player increases their unmodified Strength to match the opposing player's for the duration of the Block action. Modifiers are then applied normally. If this player also has a Skill that allows multiple Block actions, such as Frenzy, they must make a separate roll for each Block action.",
  },
  leader: {
    description:
      "Une équipe qui a un ou plusieurs joueurs ayant cette Compétence sur le terrain au début d'une mi-temps gagne une unique Relance d'Équipe bonus : on l'appelle une Relance de Chef. Une équipe peut utiliser une Relance de Chef seulement si elle a un joueur avec la Compétence Chef sur le terrain, et si tous les joueurs ayant cette Compétence sont retirés du jeu, à cause d'une Élimination ou d'une Expulsion, avant que la Relance de Chef ait été utilisée, alors elle est perdue. Une Relance de Chef suit toutes les règles des Relances d'Équipe normales, à l'exception du fait qu'on ne peut pas la perdre à cause d'un Chef Cuistot Halfling.",
    descriptionEn:
      "A team that has one or more players with this Skill on the pitch at the start of a half gains a single bonus Team Re-roll called a Leader Re-roll. A team may only use a Leader Re-roll if they have a player with the Leader Skill on the pitch, and if all players with this Skill are removed from play, due to a Casualty or Sending-off, before the Leader Re-roll is used, it is lost. A Leader Re-roll follows all the rules for Team Re-rolls, except it cannot be lost due to a Halfling Master Chef.",
  },
  pro: {
    description:
      "Pendant l'activation de ce joueur, il peut tenter de relancer un unique dé. Il peut s'agir d'un dé jeté individuellement, dans le cadre d'un jet de plusieurs dés, ou faisant partie d'un groupe de dés. Pour utiliser cette Compétence, le joueur doit jeter un D6 : sur 3+, on peut relancer le dé, sur 1-2, on ne peut pas relancer le dé. On ne peut pas utiliser la Compétence pour relancer un dé dans le cadre d'un Jet d'Armure, Jet de Blessure, Jet d'Élimination, jet fait en dehors de l'activation du joueur, ou jet n'étant pas fait au nom du joueur (comme Contester la Décision, ou une Intervention du Public). Une fois qu'un joueur a tenté d'utiliser cette Compétence, il ne peut utiliser aucune autre relance quelle qu'en soit la source pour relancer le dé.",
    descriptionEn:
      "During this player's activation, they may attempt to re-roll a single dice. This may be a dice rolled on its own, as part of a multiple dice roll, or as part of a dice pool. To use this Skill, roll a D6: on 3+, the dice may be re-rolled; on 1-2, it cannot. This Skill cannot be used to re-roll a dice as part of an Armour Roll, Injury Roll, Casualty Roll, a roll made outside this player's activation, or a roll not made on behalf of this player (such as a Argue the Call roll or a Crowd Interference roll). Once a player has attempted to use this Skill, they may not use any other re-roll from any source to re-roll that dice.",
  },
  shadowing: {
    description:
      "Chaque fois qu'un joueur adverse tente d'Esquiver hors d'une case dans la Zone de Tacle de ce joueur, ce joueur peut utiliser cette Compétence. Quand ce joueur utilise cette Compétence, jetez un D6. Sur un 1-3, rien ne se passe. Sur 4+, ce joueur est immédiatement placé sur la case que le joueur adverse a libérée. Ce joueur peut utiliser cette Compétence autant de fois par Tour que la valeur de son Mouvement. Si un joueur essaie de quitter la Zone de Tacle de plusieurs joueurs ayant cette Compétence en même temps, un seul de ces joueurs peut utiliser cette Compétence.",
    descriptionEn:
      "Each time an opposing player attempts to Dodge out of a square in this player's Tackle Zone, this player may use this Skill. When used, roll a D6. On 1-3, nothing happens. On 4+, this player is immediately placed on the square the opposing player vacated. This player may use this Skill a number of times per turn equal to their Movement characteristic. If a player tries to leave the Tackle Zone of multiple players with this Skill simultaneously, only one of them may use this Skill.",
  },
  "sure-hands": {
    description:
      "Ce joueur peut relancer le D6 quand il tente de ramasser le ballon, mais pas quand il fait une Action de Sécurisation du Ballon. De plus, on ne peut pas utiliser la Compétence Arracher le Ballon contre ce joueur.",
    descriptionEn:
      "This player may re-roll the D6 when attempting to pick up the ball, but not when performing a Secure the Ball action. In addition, the Strip Ball Skill cannot be used against this player.",
  },
  tackle: {
    description:
      "Quand un joueur adverse tente d'Esquiver depuis une case dans la Zone de Tacle de ce joueur, il ne peut pas utiliser la Compétence Esquive. De plus, quand ce joueur effectue une Action de Blocage contre un joueur adverse, le joueur adverse ne compte pas comme ayant la Compétence Esquive si on choisit un résultat Bousculé.",
    descriptionEn:
      "When an opposing player attempts to Dodge from a square in this player's Tackle Zone, they cannot use the Dodge Skill. In addition, when this player performs a Block action against an opposing player, that player cannot use the Dodge Skill if a Push Back result is chosen.",
  },
  wrestle: {
    description:
      "Quand ce joueur effectue une Action de Blocage, ou quand il est la cible d'une Action de Blocage, si on choisit le résultat Les Deux Plaqués, ce joueur peut choisir d'utiliser cette Compétence. En ce cas, les deux joueurs de l'Action de Blocage sont Mis À Terre, quelles que soient les Compétences qu'ils possèdent.",
    descriptionEn:
      "When this player performs a Block action, or when they are the target of a Block action, if the Both Down result is chosen, this player may choose to use this Skill. If they do, both players involved in the Block action are Placed Prone, regardless of any Skills either player may have.",
  },

  // Catégorie Passe
  "cloud-burster": {
    description:
      "Quand ce joueur effectue une Action de Passe, les joueurs adverses ne peuvent pas tenter d'Intercepter le ballon.",
    descriptionEn:
      "When this player performs a Pass action, opposing players cannot attempt to Intercept the ball.",
  },
  "dump-off": {
    description:
      "Chaque fois qu'un joueur adverse tente d'effectuer une Action de Blocage contre ce joueur, ou une Action Spéciale qui cible directement ce joueur, ce joueur peut utiliser cette Compétence. En ce cas, ce joueur peut immédiatement effectuer une Passe Rapide avant qu'on résolve l'Action qui le cible. Cette Passe Rapide ne peut pas provoquer de Turnover, mais suit autrement les règles normales pour faire une Passe Rapide. Une fois la Passe Rapide résolue, l'Action qui cible ce joueur continue.",
    descriptionEn:
      "Each time an opposing player attempts to perform a Block action against this player, or a Special Action that directly targets this player, this player may use this Skill. If they do, they may immediately perform a Quick Pass before the targeting action is resolved. This Quick Pass cannot cause a Turnover, but otherwise follows all normal rules. Once the Quick Pass is resolved, the action targeting this player continues.",
  },
  "on-the-ball": {
    description:
      "Quand un joueur adverse effectue une Action de Passe, après avoir annoncé la case cible mais avant de faire le Test de Capacité de Passe, ce joueur peut se déplacer de jusqu'à 3 cases, selon toutes les règles normales pour une Action de Mouvement, à l'exception du fait qu'il ne peut pas Foncer. Si ce joueur Chute pendant ce mouvement, alors son mouvement prend immédiatement fin et l'Action de Passe reprend. Si plusieurs joueurs ont cette Compétence, alors ils peuvent tous l'utiliser pendant la même Action de Passe, mais ils doivent le faire un à la fois et si l'un d'eux Chute avant que les autres aient eu l'occasion de se déplacer, ils ne peuvent plus se déplacer. De plus, pendant la Séquence de Début de Phase, après que le Coup d'Envoi a Dévié mais avant de faire le jet d'Événement de Coup d'Envoi, un seul joueur Démarqué de l'équipe qui réceptionne et ayant cette Compétence peut se déplacer de jusqu'à 3 cases, selon toutes les règles normales pour une Action de Mouvement, à l'exception du fait qu'il ne peut pas Foncer. Un joueur ne peut pas utiliser cette Compétence si un Renvoi s'ensuit, et il ne peut pas se déplacer dans la moitié de terrain adverse. Si ce joueur Chute pendant ce mouvement, alors son mouvement prend immédiatement fin et on fait le jet de l'Événement du Coup d'Envoi.",
    descriptionEn:
      "When an opposing player performs a Pass action, after the target square is announced but before the Passing Ability test is made, this player may move up to 3 squares following all normal rules for a Move action, except they cannot Rush. If this player Falls Over, their movement immediately ends and the Pass action resumes. If multiple players have this Skill, they may all use it during the same Pass action, one at a time; if one Falls Over before the others have moved, they cannot. In addition, during the Start of Drive sequence, after the Kick-off has Deviated but before the Kick-off Event roll, a single unmarked player on the receiving team with this Skill may move up to 3 squares following normal Move action rules, except they cannot Rush or move into the opposing half. If this player Falls Over, their movement ends immediately and the Kick-off Event roll is made.",
  },

  // Catégorie Force
  "arm-bar": {
    description:
      "Si un joueur adverse Chute en tentant d'Esquiver, Sauter ou Bondir depuis une case dans la Zone de Tacle de ce joueur, ce joueur peut utiliser cette Compétence. En ce cas, il peut appliquer un modificateur de +1 soit au Jet d'Armure, soit au Jet de Blessure. On peut appliquer ce modificateur après avoir fait le jet. Si le joueur adverse subit une Élimination suite à une Esquive, un Saut ou un Bond raté depuis une case dans la Zone de Tacle de ce joueur, alors celui-ci compte comme ayant causé cette Élimination et reçoit les Points de Star Player correspondant. Si un joueur tente de quitter la Zone de Tacle de plusieurs joueurs ayant cette Compétence en même temps, un seul de ces joueurs peut utiliser cette Compétence.",
    descriptionEn:
      "If an opposing player Falls Over when attempting to Dodge, Jump, or Leap from a square in this player's Tackle Zone, this player may use this Skill. If they do, they may apply a +1 modifier to either the Armour Roll or the Injury Roll. This modifier may be applied after the roll. If the opposing player suffers a Casualty as a result of a failed Dodge, Jump, or Leap from a square in this player's Tackle Zone, this player counts as having caused the Casualty and gains the corresponding Star Player Points. If a player tries to leave the Tackle Zone of multiple players with this Skill simultaneously, only one may use this Skill.",
  },
  grab: {
    description:
      "Quand ce joueur annonce une Action de Blocage, si le joueur adverse est Repoussé, alors le Coach de ce joueur peut choisir n'importe quelle case inoccupée adjacente à la cible pour l'y Repousser. S'il n'y a pas de case adjacente inoccupée, alors on ne peut pas utiliser cette Compétence. De plus, quand ce joueur effectue une Action de Blocage, les joueurs adverses ne peuvent pas utiliser la Compétence Glissade Contrôlée. Un joueur ayant cette Compétence ne peut pas aussi avoir la Compétence Frénésie.",
    descriptionEn:
      "When this player declares a Block action, if the opposing player is Pushed Back, this player's coach may choose any unoccupied square adjacent to the target to Push them Back into. If there is no unoccupied adjacent square, this Skill cannot be used. In addition, when this player performs a Block action, opposing players cannot use the Side Step Skill. A player with this Skill cannot also have the Frenzy Skill.",
  },
  juggernaut: {
    description:
      "Quand ce joueur annonce une Action de Blitz, il peut traiter tout résultat Les Deux Plaqués comme Repoussé lors de toutes les Actions de Blocage qu'il effectue pendant l'Action de Blitz. De plus, quand ce joueur effectue une Action de Blocage dans le cadre d'une Action de Blitz, les joueurs adverses ne peuvent pas utiliser les Compétences Parade, Stabilité ni Lutte.",
    descriptionEn:
      "When this player declares a Blitz action, they may treat any Both Down results as a Push Back for all Block actions performed during that Blitz action. In addition, when this player performs a Block action as part of a Blitz action, opposing players cannot use the Fend, Stand Firm, or Wrestle Skills.",
  },
  "mighty-blow-1": {
    description:
      "Chaque fois que ce joueur Plaque un joueur adverse lors d'une Action de Blocage, même si ce joueur est aussi Plaqué, il peut appliquer un modificateur de +1 soit au Jet d'Armure, soit au Jet de Blessure. On peut appliquer ce modificateur après avoir fait le jet.",
    descriptionEn:
      "Each time this player Knocks Down an opposing player as the result of a Block action, even if this player is also Knocked Down, they may apply a +1 modifier to either the Armour Roll or the Injury Roll. This modifier may be applied after the roll.",
  },
  "pile-driver": {
    description:
      "Quand un joueur adverse est Plaqué par ce joueur durant une Action de Blocage, ce joueur peut effectuer une Action d'Agression gratuite contre le joueur adverse tant qu'il est toujours Debout et qu'il Marque toujours le joueur adverse. Puis ce joueur est Mis À Terre et son activation prend immédiatement fin.",
    descriptionEn:
      "When an opposing player is Knocked Down by this player as the result of a Block action, this player may perform a free Foul action against the opposing player as long as they are still Standing and still Marking the opposing player. Then this player is Placed Prone and their activation immediately ends.",
  },

  // Catégorie Mutations
  "big-hand": {
    description:
      "Ce joueur ignore tous les modificateurs négatifs quand il tente de ramasser le ballon.",
    descriptionEn:
      "This player ignores all negative modifiers when attempting to pick up the ball.",
  },
  "disturbing-presence": {
    description:
      "Tout joueur adverse qui effectue une Action de Passe, une Action de Lancer de Coéquipier ou une Action Spéciale de Lancer de Bombe, ou tente d'Intercepter ou de Réceptionner le ballon, applique un modificateur de -1 au Test de Capacité de Passe ou d'Agilité pour chaque joueur de votre équipe ayant cette Compétence et étant à 3 cases ou moins de lui.",
    descriptionEn:
      "Any opposing player who performs a Pass action, Throw Team-mate action, or Throw Bomb Special Action, or attempts to Intercept or Catch the ball, applies a -1 modifier to their Passing Ability or Agility test for each player on your team with this Skill within 3 squares of them.",
  },
  horns: {
    description:
      "Chaque fois que ce joueur annonce une Action de Blitz, alors il applique un modificateur de +1 à sa Caractéristique de Force pour toutes les Actions de Blocage effectuées durant cette Action de Blitz.",
    descriptionEn:
      "Each time this player declares a Blitz action, they apply a +1 modifier to their Strength characteristic for all Block actions performed during that Blitz action.",
  },
  "iron-hard-skin": {
    description:
      "Les joueurs adverses ne peuvent appliquer aucun modificateur quand ils font un Jet d'Armure contre ce joueur. De plus, on ne peut pas utiliser la Compétence Griffes contre ce joueur.",
    descriptionEn:
      "Opposing players cannot apply any modifiers when making an Armour Roll against this player. In addition, the Claws Skill cannot be used against this player.",
  },
  "prehensile-tail": {
    description:
      "Quand un joueur adverse tente d'Esquiver, de Bondir ou de Sauter depuis une case dans la Zone de Tacle de ce joueur, il applique un modificateur de -1 supplémentaire au Test d'Agilité. Si un joueur tente de quitter la Zone de Tacle de plusieurs joueurs ayant cette Compétence en même temps, un seul de ces joueurs peut utiliser cette Compétence.",
    descriptionEn:
      "When an opposing player attempts to Dodge, Leap, or Jump from a square in this player's Tackle Zone, they apply an additional -1 modifier to their Agility test. If a player tries to leave the Tackle Zone of multiple players with this Skill simultaneously, only one may use this Skill.",
  },
  tentacles: {
    description:
      "Quand un joueur adverse tente d'Esquiver, de Bondir ou de Sauter depuis une case dans la Zone de Tacle de ce joueur, ce joueur peut utiliser cette Compétence. Quand un joueur utilise cette Compétence, il jette un D6 et ajoute sa Caractéristique de Force au jet ; il soustrait ensuite la Caractéristique de Force du joueur adverse au résultat. Si le résultat est 6 ou plus, ou si le jet est un 6 naturel, alors le joueur adverse ne quitte pas la case qu'il tentait de quitter et son activation prend fin. Si le résultat est 5 ou moins, ou si le jet est un 1 naturel, cette Compétence n'a pas d'effet. Si un joueur tente de quitter la Zone de Tacle de plusieurs joueurs ayant cette Compétence en même temps, un seul de ces joueurs peut utiliser cette Compétence.",
    descriptionEn:
      "When an opposing player attempts to Dodge, Leap, or Jump from a square in this player's Tackle Zone, this player may use this Skill. When used, roll a D6 and add this player's Strength; subtract the opposing player's Strength from the result. On 6+, or a natural 6, the opposing player does not leave the square they were trying to leave and their activation ends. On 5 or less, or a natural 1, this Skill has no effect. If a player tries to leave the Tackle Zone of multiple players with this Skill simultaneously, only one may use this Skill.",
  },
};

