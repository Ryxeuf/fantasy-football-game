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
};

/**
 * Descriptions canoniques Saison 3 issues de la retranscription OCR officielle
 * (voir `extraction_blood_bowl.md`, `extraction_competences_blood_bowl.md` et
 * `extraction_competences_traits_blood_bowl.md`).
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
};

