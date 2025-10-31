"use client";
import { useState, useMemo } from "react";
import { useLanguage } from "../contexts/LanguageContext";

// Types pour les compétences et traits
interface Skill {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  isCompulsory?: boolean;
}

interface SkillCategory {
  name: string;
  nameEn: string;
  skills: Skill[];
}

// Données des compétences organisées par catégories
const skillsData: SkillCategory[] = [
  {
    name: "Compétences d'Agilité",
    nameEn: "Agility Skills",
    skills: [
      {
        name: "Réception",
        nameEn: "Catch",
        description: "Ce joueur peut relancer un test d'Agilité raté quand il tente de réceptionner le ballon.",
        descriptionEn: "This player may re-roll a failed Agility test when attempting to catch the ball.",
        category: "Agility"
      },
      {
        name: "Réception Plongeante",
        nameEn: "Diving Catch",
        description: "Ce joueur peut tenter de réceptionner le ballon si une passe, un renvoi ou un coup d'envoi le fait atterrir sur une case de la Zone de Tacle de ce joueur après avoir dévié ou ricoché. Cette compétence ne permet pas au joueur de tenter de réceptionner le ballon s'il rebondit sur une case de sa Zone de Tacle. De plus, ce joueur peut appliquer un modificateur de +1 à ses tentatives de réceptionner une passe précise s'il occupe la case cible.",
        descriptionEn: "This player may attempt to catch the ball if a pass, throw-in or kick-off causes it to land in a square within their Tackle Zone after scattering or deviating. This Skill does not allow this player to attempt to catch the ball if it bounces into a square within their Tackle Zone. Additionally, this player may apply a +1 modifier to any attempt to catch an accurate pass if they occupy the target square.",
        category: "Agility"
      },
      {
        name: "Tacle Plongeant",
        nameEn: "Diving Tackle",
        description: "Si un joueur adverse actif qui tente d'Esquiver, d'Enjamber ou de Sauter pour quitter une case où il est Marqué par ce joueur réussit son test d'Agilité, vous pouvez annoncer que ce joueur va utiliser cette compétence. Votre adversaire doit immédiatement soustraire 2 au résultat du test d'Agilité. Puis ce joueur est Mis À Terre dans la case laissée vacante par le joueur adverse. Si le joueur adverse était Marqué par plusieurs joueurs ayant cette compétence, un seul joueur peut l'utiliser.",
        descriptionEn: "Should an active opposition player that is attempting to Dodge, Jump or Leap in order to vacate a square in which they are being Marked by this player pass their Agility test, you may declare that this player will use this Skill. Your opponent must immediately subtract 2 from the result of the Agility test. This player is then Placed Prone in the square vacated by the opposition player.",
        category: "Agility"
      },
      {
        name: "Esquive",
        nameEn: "Dodge",
        description: "Une fois par tour d'équipe, pendant son activation, ce joueur peut relancer un test d'Agilité raté quand il tente d'Esquiver. De plus, ce joueur peut choisir d'utiliser cette compétence quand il est la cible d'une action de Blocage et qu'il subit un résultat Défenseur Bousculé, comme décrit page 57.",
        descriptionEn: "Once per team turn, during their activation, this player may re-roll a failed Agility test when attempting to Dodge. Additionally, this player may choose to use this Skill when they are the target of a Block action and a Stumble result is applied against them.",
        category: "Agility"
      },
      {
        name: "Défenseur",
        nameEn: "Defensive",
        description: "Pendant le tour d'équipe adverse (et pas pendant votre tour d'équipe), les joueurs adverses Marqués par ce joueur ne peuvent pas utiliser la compétence Garde.",
        descriptionEn: "During your opponent's team turn (but not during your own team turn), any opposition players being Marked by this player cannot use the Guard skill.",
        category: "Agility"
      },
      {
        name: "Équilibre",
        nameEn: "Sure Feet",
        description: "Une fois par tour d'équipe, pendant son activation, ce joueur peut relancer le D6 quand il tente de Foncer.",
        descriptionEn: "Once per team turn, during their activation, this player may re-roll the D6 when attempting to Rush.",
        category: "Agility"
      },
      {
        name: "Rétablissement",
        nameEn: "Jump Up",
        description: "Si ce joueur est À Terre, il peut se relever gratuitement (cela ne lui coûte pas trois (3) cases de Mouvement, comme c'est normalement le cas). De plus, si ce joueur est À Terre quand il est activé, il peut tenter un Rétablissement et effectuer une action de Blocage. Ce joueur fait un test d'Agilité, en appliquant un modificateur de +1. Si le test est réussi, il se relève et peut effectuer l'action de Blocage. Si le test est raté, il reste À Terre et son activation se termine.",
        descriptionEn: "If this player is Prone they may stand up for free. Additionally, if this player is Prone when activated, they may attempt to Jump Up and perform a Block action.",
        category: "Agility"
      },
      {
        name: "Saut",
        nameEn: "Leap",
        description: "Pendant son mouvement, au lieu d'Enjamber une seule case occupée par un joueur À Terre ou Sonné, comme décrit page 45, un joueur ayant cette compétence peut choisir d'effectuer un Saut par-dessus n'importe quelle case adjacente, y compris les cases inoccupées et les cases occupées par des joueurs Debout. De plus, ce joueur peut réduire de 1, jusqu'à un minimum de -1, tout modificateur négatif qui s'applique au test d'Agilité quand il tente d'Enjamber un joueur À Terre ou Sonné, ou de Sauter par-dessus une case inoccupée ou occupée par un joueur Debout. Un joueur ayant cette compétence ne peut pas aussi avoir le trait Échasse à Ressort.",
        descriptionEn: "During their movement, instead of jumping over a single square that is occupied by a Prone or Stunned player, a player with this Skill may choose to Leap over any single adjacent square, including unoccupied squares and squares occupied by Standing players.",
        category: "Agility"
      },
      {
        name: "Libération Contrôlée",
        nameEn: "Safe Pair of Hands",
        description: "Si ce joueur est Plaqué ou Mis À Terre (mais pas s'il Chute) alors qu'il est en possession du ballon, le ballon ne rebondit pas. À la place, vous pouvez poser le ballon sur une case inoccupée adjacente à celle que ce joueur occupait quand il s'est retrouvé À Terre.",
        descriptionEn: "If this player is Knocked Down or Placed Prone (but not if they Fall Over) whilst in possession of the ball, the ball does not bounce. Instead, you may place the ball in an unoccupied square adjacent to the one this player occupies when they become Prone.",
        category: "Agility"
      },
      {
        name: "Glissade Contrôlée",
        nameEn: "Sidestep",
        description: "Si ce joueur est repoussé pour une raison quelconque, il n'est pas déplacé sur une case choisie par le coach adverse. À la place vous pouvez choisir une case inoccupée adjacente à ce joueur, et il est repoussé dans la case choisie. S'il n'y a pas de cases inoccupées adjacentes à ce joueur, cette compétence ne peut pas être utilisée.",
        descriptionEn: "If this player is pushed back for any reason, they are not moved into a square chosen by the opposing coach. Instead you may choose any unoccupied square adjacent to this player.",
        category: "Agility"
      },
      {
        name: "Vaurien",
        nameEn: "Sneaky Git",
        description: "Lorsque ce joueur effectue une action de Faute, il n'est pas Expulsé pour avoir commis une Faute s'il fait un double naturel sur le jet d'Armure. De plus, l'activation de ce joueur n'a pas besoin de se terminer une fois la Faute commise.",
        descriptionEn: "When this player performs a Foul action, they are not Sent-off for committing a Foul should they roll a natural double on the Armour roll. Additionally, the activation of this player does not have to end once the Foul has been committed.",
        category: "Agility"
      },
      {
        name: "Sprint",
        nameEn: "Sprint",
        description: "Lorsque ce joueur effectue une action qui inclut le mouvement, il peut tenter de Courir trois fois, plutôt que les deux habituelles.",
        descriptionEn: "When this player performs any action that includes movement, they may attempt to Rush three times, rather than the usual two.",
        category: "Agility"
      },
      {
        name: "Sournois",
        nameEn: "Sneaky Git",
        description: "Quand ce joueur effectue une action d'Agression, il n'est pas Expulsé pour Agression s'il obtient un double naturel sur le jet d'Armure. De plus, l'activation de ce joueur ne prend pas obligatoirement fin une fois l'Agression commise. Si vous le souhaitez, et s'il n'a pas utilisé tout son Mouvement, il peut continuer de se déplacer après avoir commis l'Agression.",
        descriptionEn: "When this player performs a Foul action, they are not Sent-off for committing a Foul should they roll a natural double on the Armour roll. Additionally, the activation of this player does not have to end once the Foul has been committed.",
        category: "Agility"
      },
      {
        name: "Sprint",
        nameEn: "Sprint",
        description: "Quand ce joueur fait une action qui inclut un mouvement, il peut tenter de Foncer trois fois, au lieu des deux fois habituelles.",
        descriptionEn: "When this player performs any action that includes movement, they may attempt to Rush three times, rather than the usual two.",
        category: "Agility"
      },
    ]
  },
  {
    name: "Compétences Générales",
    nameEn: "General Skills",
    skills: [
      {
        name: "Blocage",
        nameEn: "Block",
        description: "Quand on obtient le résultat Les Deux Plaqués lors d'une action de Blocage, ce joueur peut choisir de l'ignorer et ne pas être Plaqué (voir page 57).",
        descriptionEn: "When a Both Down result is applied during a Block action, this player may choose to ignore it and not be Knocked Down.",
        category: "General"
      },
      {
        name: "Intrépide",
        nameEn: "Dauntless",
        description: "Quand ce joueur fait une action de Blocage (y compris pendant une action de Blitz), si la cible désignée a une caractéristique de Force supérieure à celle de ce joueur avant de compter les soutiens offensifs ou défensifs, mais après avoir appliqué les autres modificateurs, jetez un D6 et ajoutez la caractéristique de Force de ce joueur au résultat. Si le total est supérieur à la caractéristique de Force de la cible, ce joueur augmente sa caractéristique de Force jusqu'à être égale à celle de la cible de l'action de Blocage, avant de compter les soutiens offensifs ou défensifs, pour la durée de cette action de Blocage. Si ce joueur a une autre compétence qui lui permet d'effectuer plusieurs actions de Blocage, comme Frénésie, il doit faire un jet d'Intrépide pour chacune de ses actions de Blocage.",
        descriptionEn: "When this player performs a Block action, if the nominated target has a higher Strength characteristic than this player before counting offensive or defensive assists but after applying any other modifiers, roll a D6 and add this player's Strength characteristic to the result.",
        category: "General"
      },
      {
        name: "Joueur Déloyal (+1)",
        nameEn: "Dirty Player (+1)",
        description: "Quand ce joueur fait une action d'Agression, vous pouvez modifier soit le jet d'Armure, soit le jet de Blessure, effectué contre la victime, du montant indiqué entre parenthèses. Ce modificateur peut être appliqué après avoir fait le jet.",
        descriptionEn: "When this player commits a Foul action, either the Armour roll or Injury roll made against the victim may be modified by the amount shown in brackets.",
        category: "General"
      },
      {
        name: "Parade",
        nameEn: "Fend",
        description: "Si ce joueur est repoussé à cause d'un résultat de dé de blocage s'appliquant à lui, il peut choisir d'empêcher le joueur qui l'a repoussé de le poursuivre. Toutefois, le joueur qui l'a repoussé peut continuer de se déplacer s'il est en train de faire une action de Blitz s'il lui reste du Mouvement ou en Fonçant. Cette compétence ne peut pas être utilisée quand ce joueur est poussé à la chaîne, contre un joueur ayant le trait Chaîne et Boulet, ou contre un joueur ayant la compétence Juggernaut qui a effectué l'action de Blocage pendant un Blitz. Notez que si un joueur adverse en possession du ballon est repoussé dans votre Zone d'En-but en étant encore Debout, il marque un touchdown, mettant fin à la phase de jeu. Dans ce cas, la seconde action de Blocage n'est pas effectuée. Un joueur ayant cette compétence ne peut pas aussi avoir la compétence Projection.",
        descriptionEn: "If this player is pushed back as the result of any block dice result being applied against them, they may choose to prevent the player that pushed them back from following-up.",
        category: "General"
      },
      {
        name: "Frénésie",
        nameEn: "Frenzy",
        description: "Chaque fois que ce joueur fait une action de Blocage (y compris pendant une action de Blitz), il doit poursuivre si la cible est repoussée et s'il en est capable. Si la cible est encore Debout après avoir été repoussée, et si ce joueur a pu poursuivre, il doit faire une seconde action de Blocage contre la même cible, et la poursuivre à nouveau si elle est repoussée. Si ce joueur est en train de faire une action de Blitz, la seconde action de Blocage lui coûte une case de Mouvement. S'il ne lui reste plus de Mouvement pour faire une seconde action de Blocage, il doit Foncer pour la faire. S'il ne peut pas Foncer, il ne peut pas faire une seconde action de Blocage.",
        descriptionEn: "Every time this player performs a Block action, they must follow-up if the target is pushed back and if they are able. If the target is still Standing after being pushed back, and if this player was able to follow-up, this player must then perform a second Block action against the same target.",
        category: "General",
        isCompulsory: true
      },
      {
        name: "Frappe Précise",
        nameEn: "Kick",
        description: "Si ce joueur est désigné pour donner un coup d'envoi, vous pouvez décider de diviser par deux le résultat du D6 déterminant le nombre de cases sur lesquelles le ballon dévie, en arrondissant à l'entier inférieur.",
        descriptionEn: "If this player is nominated to be the kicking player during a kick-off, you may choose to halve the result of the D6 to determine the number of squares that the ball deviates, rounding any fractions down.",
        category: "General"
      },
      {
        name: "Pro",
        nameEn: "Pro",
        description: "Pendant son activation, ce joueur peut tenter de relancer 1 dé. Ce dé peut être celui d'un jet de dé unique, faire partie d'un jet de plusieurs dés, ou faire partie d'un groupe de dés, mais ne peut pas être un dé d'un jet d'Armure, de Blessure ni d'Élimination. Jetez un D6: Sur 3+, le dé peut être relancé. Sur 1 ou 2, le dé ne peut pas être relancé. Une fois que ce joueur a tenté d'utiliser cette compétence, il ne peut pas utiliser une relance provenant d'une autre source.",
        descriptionEn: "During their activation, this player may attempt to re-roll one dice. This dice may have been rolled either as a single dice roll, as part of a multiple dice roll or as part of a dice pool, but cannot be a dice that was rolled as part of an Armour, Injury or Casualty roll.",
        category: "General"
      },
      {
        name: "Poursuite",
        nameEn: "Shadowing",
        description: "Ce joueur peut utiliser cette compétence quand un joueur adverse qu'il Marque se déplace volontairement hors d'une case de sa Zone de Tacle. Jetez un D6, et ajoutez le Mouvement de ce joueur au jet, puis soustrayez le Mouvement du joueur adverse. Si le résultat est 6 ou plus, ou si le jet est un 6 naturel, ce joueur peut immédiatement se déplacer sur la case laissée vacante par le joueur adverse (ce joueur n'a pas à Esquiver pour faire ce mouvement). Si le résultat est 5 ou moins, ou si le jet est un 1 naturel, cette compétence n'a pas d'autre effet.",
        descriptionEn: "This player can use this Skill when an opposition player they are Marking voluntarily moves out of a square within this player's Tackle Zone.",
        category: "General"
      },
      {
        name: "Arracher le Ballon",
        nameEn: "Strip Ball",
        description: "Quand ce joueur cible un joueur adverse qui est en possession du ballon avec une action de Blocage (y compris pendant une action de Blitz), un résultat Repoussé fait lâcher le ballon joueur qui le porte, dans la case où il est repoussé. Puis le ballon rebondit depuis la case où le joueur est repoussé, comme s'il avait été Plaqué.",
        descriptionEn: "When this player targets an opposition player that is in possession of the ball with a Block action, choosing to apply a Push Back result will cause that player to drop the ball in the square they are pushed back into.",
        category: "General"
      },
      {
        name: "Prise Sûre",
        nameEn: "Sure Hands",
        description: "Un joueur peut utiliser cette compétence plusieurs fois par tour, pendant les deux tours d'équipe. Si un joueur adverse est Marqué par plusieurs joueurs ayant cette compétence, un seul joueur peut l'utiliser. Ce joueur peut relancer les tentatives de ramasser le ballon. De plus, la compétence Arracher le Ballon ne peut pas être utilisée contre un joueur ayant cette compétence.",
        descriptionEn: "This player may re-roll any failed attempt to pick up the ball. In addition, the Strip Ball skill cannot be used against a player with this Skill.",
        category: "General"
      },
      {
        name: "Tacle",
        nameEn: "Tackle",
        description: "Quand un joueur adverse actif tente d'Esquiver depuis une case où il était Marqué par un ou plusieurs joueurs de votre équipe ayant cette compétence, le joueur adverse ne peut pas utiliser la compétence Esquive. De plus, quand un joueur adverse est ciblé par une action de Blocage effectuée par un joueur ayant cette compétence, le joueur adverse ne peut pas utiliser la compétence Esquive si un résultat Défenseur Bousculé s'applique à lui.",
        descriptionEn: "When an active opposition player attempts to Dodge from a square in which they were being Marked by one or more players on your team with this Skill, that player cannot use the Dodge skill.",
        category: "General"
      },
      {
        name: "Lutte",
        nameEn: "Wrestle",
        description: "Ce joueur peut utiliser cette compétence quand un résultat Les Deux Plaqués s'applique, quand il fait une action de Blocage ou quand il est la cible d'une action de Blocage. Au lieu d'appliquer normalement le résultat Les Deux Plaqués, et quelles que soient les autres compétences que les joueurs possèdent, les deux joueurs sont Mis A Terre.",
        descriptionEn: "This player may use this Skill when a Both Down result is applied, either when they perform a Block action or when they are the target of a Block action.",
        category: "General"
      }
    ]
  },
  {
    name: "Mutations",
    nameEn: "Mutations",
    skills: [
      {
        name: "Grande Main",
        nameEn: "Big Hand",
        description: "Ce joueur peut ignorer tout modificateur pour être Marquage ou pour les conditions météorologiques de Pluie Battante lorsqu'il tente de ramasser le ballon.",
        descriptionEn: "This player may ignore any modifier(s) for being Marked or for Pouring Rain weather conditions when they attempt to pick up the ball.",
        category: "Mutations"
      },
      {
        name: "Griffes",
        nameEn: "Claws",
        description: "Lorsque vous faites un jet d'Armure contre un joueur adverse qui a été Renversé à la suite d'une action de Bloc effectuée par ce joueur, un jet de 8+ avant d'appliquer tout modificateur brisera son armure, quelle que soit sa Valeur d'Armure réelle.",
        descriptionEn: "When you make an Armour roll against an opposition player that was Knocked Down as the result of a Block action performed by this player, a roll of 8+ before applying any modifiers will break their armour, regardless of their actual Armour Value.",
        category: "Mutations"
      },
      {
        name: "Présence Perturbante",
        nameEn: "Disturbing Presence",
        description: "Lorsqu'un joueur adverse effectue soit une action de Passe, soit une action de Lancer d'Équipier, soit une action Spéciale de Lancer de Bombe, ou tente soit d'interférer avec une passe soit d'attraper le ballon, il doit appliquer un modificateur -1 au test pour chaque joueur de votre équipe avec cette compétence qui est à trois cases de lui.",
        descriptionEn: "When an opposition player performs either a Pass action, a Throw Team-mate action or a Throw Bomb Special action, or attempts to either interfere with a pass or to catch the ball, they must apply a -1 modifier to the test for each player on your team with this Skill that is within three squares of them.",
        category: "Mutations",
        isCompulsory: true
      },
      {
        name: "Bras Supplémentaires",
        nameEn: "Extra Arms",
        description: "Ce joueur peut appliquer un modificateur de +1 quand il tente de ramasser ou de réceptionner le ballon, ou d'interférer avec une passe.",
        descriptionEn: "This player may apply a +1 modifier when they attempt to pick up or catch the ball, or when they attempt to interfere with a pass.",
        category: "Mutations"
      },
      {
        name: "Apparence Répugnante",
        nameEn: "Foul Appearance",
        description: "Lorsqu'un joueur adverse déclare une action de Bloc ciblant ce joueur, ou toute action Spéciale qui cible ce joueur, son entraîneur doit d'abord lancer un D6, même si ce joueur a perdu sa Zone de Tackle. Sur un jet de 1, le joueur ne peut pas effectuer l'action déclarée et l'action est gaspillée.",
        descriptionEn: "When an opposition player declares a Block action targeting this player, or any Special action that targets this player, their coach must first roll a D6, even if this player has lost their Tackle Zone. On a roll of 1, the player cannot perform the declared action and the action is wasted.",
        category: "Mutations",
        isCompulsory: true
      },
      {
        name: "Cornes",
        nameEn: "Horns",
        description: "Quand ce joueur fait une action de Blocage pendant une action de Blitz (pas lors d'une action de Blocage seule), vous pouvez appliquer un modificateur de +1 à la caractéristique de Force de ce joueur. Ce modificateur est appliqué avant de compter les soutiens, avant d'appliquer les autres modificateurs de Force et avant d'utiliser d'autres compétences ou traits.",
        descriptionEn: "When this player performs a Block action as part of a Blitz action (but not on its own), you may apply a +1 modifier to this player's Strength characteristic.",
        category: "Mutations"
      },
      {
        name: "Peau de Fer",
        nameEn: "Iron Hard Skin",
        description: "La compétence Griffes ne peut pas être utilisée quand on fait un jet d'Armure contre ce joueur.",
        descriptionEn: "The Claws skill cannot be used when making an Armour roll against this player. Opposing players cannot modify any Armour rolls made against this player.",
        category: "Mutations"
      },
      {
        name: "Grande Gueule",
        nameEn: "Monstrous Mouth",
        description: "Ce joueur peut relancer les tentatives ratées de réceptionner le ballon. De plus, la compétence Arracher le Ballon ne peut pas être utilisée contre lui.",
        descriptionEn: "This player may re-roll any failed attempt to catch the ball. In addition, the Strip Ball skill cannot be used against this player.",
        category: "Mutations"
      },
      {
        name: "Queue Préhensile",
        nameEn: "Prehensile Tail",
        description: "Quand un joueur adverse actif tente d'Esquiver, d'Enjamber ou de Sauter pour quitter une case où il est Marqué par ce joueur, un modificateur supplémentaire de -1 s'applique au test d'Agilité du joueur actif. Si le joueur adverse est Marqué par plusieurs joueurs ayant cette mutation, un seul joueur peut l'utiliser.",
        descriptionEn: "When an active opposition player attempts to Dodge, Jump or Leap in order to vacate a square in which they are being Marked by this player, there is an additional -1 modifier applied to the active player's Agility test.",
        category: "Mutations"
      },
      {
        name: "Répulsion*",
        nameEn: "Foul Appearance",
        description: "Quand un joueur adverse annonce une action de Blocage ciblant ce joueur (y compris pendant une action de Blitz), ou une action Spéciale ciblant ce joueur, son coach doit d'abord jeter un D6, même si ce joueur a perdu sa Zone de Tacle. Sur un jet de 1, le joueur adverse ne peut pas faire l'action annoncée, et l'action est perdue.",
        descriptionEn: "When an opposition player declares a Block action targeting this player, or any Special action that targets this player, their coach must first roll a D6, even if this player has lost their Tackle Zone. On a roll of 1, the player cannot perform the declared action and the action is wasted.",
        category: "Mutations",
        isCompulsory: true
      },
      {
        name: "Tentacules",
        nameEn: "Tentacles",
        description: "Ce joueur peut utiliser cette compétence quand un joueur adverse qu'il Marque se déplace volontairement hors d'une case de la Zone de Tacle de ce joueur. Jetez un D6 et ajoutez la caractéristique de Force de ce joueur au jet, puis soustrayez la F du joueur adverse au jet. Si le résultat est 6 ou plus, ou si le jet est un 6 naturel, le joueur adverse est maintenu sur place et son mouvement s'arrête. Si le résultat est 5 ou moins, ou si le jet est un 1 naturel, cette compétence n'a pas d'autre effet. Un joueur peut utiliser cette compétence plusieurs fois par tour, pendant les deux tours d'équipe. Si un joueur adverse est Marqué par plusieurs joueurs ayant cette compétence, un seul joueur peut l'utiliser.",
        descriptionEn: "This player can use this Skill when an opposition player they are Marking voluntarily moves out of a square within this player's Tackle Zone.",
        category: "Mutations"
      },
      {
        name: "Deux Têtes",
        nameEn: "Two Heads",
        description: "Ce joueur peut appliquer un modificateur de +1 au test d'Agilité quand il tente d'Esquiver.",
        descriptionEn: "This player may apply a +1 modifier to the Agility test when they attempt to Dodge.",
        category: "Mutations"
      },
      {
        name: "Très Longues Jambes",
        nameEn: "Very Long Legs",
        description: "Ce joueur peut réduire de 1, jusqu'à un minimum de -1, tout modificateur négatif appliqué au test d'Agilité quand il tente d'Enjamber un joueur À Terre ou Sonné (ou de Sauter par-dessus une case inoccupée ou occupée par un joueur Debout, s'il a la compétence Saut). De plus, ce joueur peut appliquer un modificateur de +2 à ses tentatives d'interférer avec une passe. Enfin, ce joueur ignore la compétence Perce-nuages.",
        descriptionEn: "This player may reduce any negative modifier applied to the Agility test when they attempt to Jump over a Prone or Stunned player by 1, to a minimum of -1.",
        category: "Mutations"
      }
    ]
  },
  {
    name: "Compétences de Passe",
    nameEn: "Passing Skills",
    skills: [
      {
        name: "Précision",
        nameEn: "Accurate",
        description: "Quand ce joueur fait une action de Passe Rapide ou de Passe Courte, vous pouvez appliquer un modificateur supplémentaire de +1 au test de Capacité de Passe.",
        descriptionEn: "When this player performs a Quick Pass action or a Short Pass action, you may apply an additional +1 modifier to the Passing Ability test.",
        category: "Passing"
      },
      {
        name: "Canonnier",
        nameEn: "Cannoneer",
        description: "Quand ce joueur fait une action de Passe Longue ou de Longue Bombe, vous pouvez appliquer un modificateur supplémentaire de +1 au test de Capacité de Passe.",
        descriptionEn: "When this player performs a Long Pass action or a Long Bomb Pass action, you may apply an additional +1 modifier to the Passing Ability test.",
        category: "Passing"
      },
      {
        name: "Perce-Nuages",
        nameEn: "Cloud Burster",
        description: "Quand ce joueur fait une action de Passe Longue ou de Longue Bombe, vous pouvez obliger le coach adverse à relancer une tentative réussie d'interférer avec la passe.",
        descriptionEn: "When this player performs a Long Pass action or a Long Bomb Pass action, you may choose to make the opposing coach re-roll a successful attempt to interfere with the pass.",
        category: "Passing"
      },
      {
        name: "Délestage",
        nameEn: "Dump-off",
        description: "Si ce joueur est la cible d'une action de Blocage (ou d'une action Spéciale accordée par une compétence ou un trait pouvant être effectuée à la place d'une action de Blocage) et s'il est en possession du ballon, il peut immédiatement faire une action de Passe Rapide, ce qui interrompt l'activation du joueur adverse effectuant l'action de Blocage (ou l'action Spéciale). Cette action de Passe Rapide ne peut pas provoquer un Turnover, mais hormis cela, toutes les règles normales de passe s'appliquent. Une fois l'action de Passe Rapide résolue, le joueur actif effectue l'action de Blocage et son tour d'équipe continue.",
        descriptionEn: "If this player is nominated as the target of a Block action and if they are in possession of the ball, they may immediately perform a Quick Pass action, interrupting the activation of the opposition player performing the Block action.",
        category: "Passing"
      },
      {
        name: "Fumblerooskie",
        nameEn: "Fumblerooskie",
        description: "Quand ce joueur fait une action de Mouvement ou de Blitz alors qu'il est en possession du ballon, il peut choisir de \"lâcher\" le ballon. Le ballon peut être placé n'importe quelle case que le joueur a quittée pendant son mouvement et il ne rebondit pas. Cela ne provoque pas de Turnover.",
        descriptionEn: "When this player performs a Move or Blitz action whilst in possession of the ball, they may choose to 'drop' the ball.",
        category: "Passing"
      },
      {
        name: "Passe Désespérée",
        nameEn: "Hail Mary Pass",
        description: "Quand ce joueur fait une action de Passe (ou de Lancer de Bombe), la case cible peut être n'importe où sur le terrain et on n'a pas besoin d'utiliser la réglette. Une Passe Désespérée n'est jamais précise, quel que soit le résultat du test de Capacité de Passe, elle sera au mieux imprécise. On fait un test de Capacité de Passe, pouvant être relancé normalement, afin de déterminer si la Passe Désespérée est méchamment imprécise ou s'il y a maladresse. On ne peut pas interférer avec une Passe Désespérée. Cette compétence ne peut pas être utilisée en cas de Blizzard.",
        descriptionEn: "When this player performs a Pass action, the target square can be anywhere on the pitch and the range ruler does not need to be used.",
        category: "Passing"
      },
      {
        name: "Chef",
        nameEn: "Leader",
        description: "Une équipe incluant un ou plusieurs joueurs ayant cette compétence gagne une seule relance d'équipe, appelée relance de Chef. Cette relance de Chef peut être utilisée seulement s'il y a au moins un joueur ayant cette compétence sur le terrain (même si le joueur ayant cette compétence est À Terre, Sonné ou a perdu sa Zone de Tacle). Si tous les joueurs ayant cette compétence sont retirés du jeu avant d'avoir pu utiliser la relance de Chef, elle est perdue. La relance de Chef peut être reportée aux prolongations si elle n'a pas été utilisée, mais l'équipe n'en reçoit pas une nouvelle au début des prolongations. Contrairement aux relances d'équipe standards, la relance de Chef ne peut pas être perdue à cause d'un Chef Cuistot Halfling. Hormis cela, la relance de Chef est traitée comme une relance d'équipe normale.",
        descriptionEn: "A team which has one or more players with this Skill gains a single extra team re-roll, called a Leader re-roll.",
        category: "Passing"
      },
      {
        name: "Nerfs d'Acier",
        nameEn: "Nerves of Steel",
        description: "Ce joueur peut ignorer les modificateurs dus au Marquage quand il tente une action de Passe, de réceptionner le ballon, ou d'interférer avec une passe.",
        descriptionEn: "This player may ignore any modifier(s) for being Marked when they attempt to perform a Pass action, attempt to catch the ball or attempt to interfere with a pass.",
        category: "Passing"
      },
      {
        name: "Sur le Ballon",
        nameEn: "On the Ball",
        description: "Ce joueur peut se déplacer de jusqu'à trois cases (quelle que soit sa caractéristique de Mouvement), en suivant les règles normales de mouvement, quand le coach adverse annonce qu'un de ses joueurs va faire une action de Passe. Ce mouvement est effectué après avoir indiqué la case cible et mesuré la portée, mais avant que le joueur actif fasse un test de Capacité de Passe. Ce mouvement interrompt l'activation du joueur adverse qui fait l'action de Passe. Un joueur peut utiliser cette compétence quand un joueur adverse utilise la compétence Délestage, mais si ce joueur Chute en se déplaçant, cela provoque un Turnover. De plus, pendant chaque séquence de Début de Phase, après l'Étape 2 mais avant l'Étape 3, un seul joueur de l'équipe qui réceptionne, Démarqué et ayant cette compétence, peut se déplacer de jusqu'à trois cases (quelle que soit son M). Cette compétence ne peut pas être utilisée quand une remise en jeu est provoquée par une déviation du coup d'envoi, et ne permet pas au joueur d'entrer dans la moitié de terrain adverse.",
        descriptionEn: "This player may move up to three squares (regardless of their MA), following all of the normal movement rules, when the opposing coach declares that one of their players is going to perform a Pass action.",
        category: "Passing"
      },
      {
        name: "Passe",
        nameEn: "Pass",
        description: "Ce joueur peut relancer un test de Capacité de Passe raté quand il fait une action de Passe.",
        descriptionEn: "This player may re-roll a failed Passing Ability test when performing a Pass action.",
        category: "Passing"
      },
      {
        name: "Passe dans la Course",
        nameEn: "Running Pass",
        description: "Si ce joueur fait une action de Passe Rapide, son activation ne se termine pas obligatoirement une fois la passe résolue. Si vous le souhaitez, ce joueur peut continuer de se déplacer après la passe s'il lui reste du Mouvement.",
        descriptionEn: "If this player performs a Quick Pass action, their activation does not have to end once the pass is resolved.",
        category: "Passing"
      },
      {
        name: "Passe Assurée",
        nameEn: "Safe Pass",
        description: "Si ce joueur rate une action de Passe, le ballon n'est pas lâché, ne rebondit pas depuis la case de ce joueur, et cela ne provoque pas de Turnover. À la place, ce joueur garde la possession du ballon et son activation se termine.",
        descriptionEn: "Should this player fumble a Pass action, the ball is not dropped, does not bounce from the square this player occupies, and no Turnover is caused.",
        category: "Passing"
      }
    ]
  },
  {
    name: "Compétences de Force",
    nameEn: "Strength Skills",
    skills: [
      {
        name: "Clé de Bras",
        nameEn: "Arm Bar",
        description: "Si un joueur adverse Chute car il a raté un test d'Agilité en tentant d'Esquiver, d'Enjamber ou de Sauter hors d'une case où il était Marqué par ce joueur, vous pouvez appliquer un modificateur de +1 soit au jet d'Armure, soit au jet de Blessure. Ce modificateur peut être appliqué après avoir effectué le jet et peut être appliqué même si ce joueur est À Terre. Si le joueur adverse était Marqué par plusieurs joueurs ayant cette compétence, un seul joueur peut l'utiliser.",
        descriptionEn: "If an opposition player Falls Over as the result of failing their Agility test when attempting to Dodge, Jump or Leap out of a square in which they were being Marked by this player, you may apply a +1 modifier to either the Armour roll or Injury roll.",
        category: "Strength"
      },
      {
        name: "Bagarreur",
        nameEn: "Brawler",
        description: "Quand ce joueur fait une action de Blocage seule (pas pendant une action de Blitz), ce joueur peut relancer 1 résultat Les Deux Plaqués.",
        descriptionEn: "When this player performs a Block action on its own (but not as part of a Blitz action), this player may re-roll a single Both Down result.",
        category: "Strength"
      },
      {
        name: "Esquive en Force",
        nameEn: "Break Tackle",
        description: "Une fois pendant son activation, après avoir effectué un test d'Agilité pour Esquiver, ce joueur peut modifier le jet de +1 si sa caractéristique de Force est de 4 ou moins, ou de +2 si sa caractéristique de Force est de 5 ou plus.",
        descriptionEn: "Once during their activation, after making an Agility test in order to Dodge, this player may modify the dice roll by +1 if their Strength characteristic is 4 or less, or by +2 if their Strength characteristic is 5 or more.",
        category: "Strength"
      },
      {
        name: "Garde",
        nameEn: "Guard",
        description: "Ce joueur peut apporter des soutiens offensifs et défensifs quel que soit le nombre de joueurs adverses qui le Marquent.",
        descriptionEn: "This player can offer both offensive and defensive assists regardless of how many opposition players are Marking them.",
        category: "Strength"
      },
      {
        name: "Juggernaut",
        nameEn: "Juggernaut",
        description: "Quand ce joueur fait une action de Blocage pendant une action de Blitz (mais pas lors d'une action de Blocage seule), il peut traiter un résultat Les Deux Plaqués comme un résultat Repoussé. De plus, quand ce joueur fait une action de Blocage pendant une action de Blitz, la cible de l'action de Blocage ne peut pas utiliser les compétences Parade, Stabilité, Lutte.",
        descriptionEn: "When this player performs a Block action as part of a Blitz action (but not on its own), they may choose to treat a Both Down result as a Push Back result.",
        category: "Strength"
      },
      {
        name: "Châtaigne (+1)",
        nameEn: "Mighty Blow (+1)",
        description: "Quand un joueur adverse est Plaqué à cause d'une action de Blocage effectuée par ce joueur (y compris pendant une action de Blitz), vous pouvez modifier soit le jet d'Armure, soit le jet de Blessure, du montant indiqué entre parenthèses. Ce modificateur peut être appliqué après avoir effectué le jet. Cette compétence ne peut pas être utilisée avec les traits Poignard ou Tronçonneuse.",
        descriptionEn: "When an opposition player is Knocked Down as the result of a Block action performed by this player, you may modify either the Armour roll or Injury roll by the amount shown in brackets.",
        category: "Strength"
      },
      {
        name: "Blocage Multiple",
        nameEn: "Multiple Block",
        description: "Quand ce joueur fait une action de Blocage seule (pas pendant une action de Blitz), il peut choisir de faire deux actions de Blocage, chacune ciblant un joueur différent parmi ceux qu'il Marque. Toutefois, cela réduit de 2 la caractéristique de Force de ce joueur, pour la durée de cette activation. Les deux actions de Blocage sont effectuées simultanément, ce qui signifie que les deux seront résolues même en cas de Turnover. Faites les jets de dés pour chaque action de Blocage séparément pour éviter toute confusion. Ce joueur ne peut pas poursuivre quand il utilise cette compétence. Notez que choisir d'utiliser cette compétence signifie que ce joueur ne pourra pas utiliser la compétence Frénésie pendant la même activation.",
        descriptionEn: "When this player performs a Block action on its own (but not as part of a Blitz action), they may choose to perform two Block actions, each targeting a different player they are Marking.",
        category: "Strength"
      },
      {
        name: "Marteau-Pilon",
        nameEn: "Pile Driver",
        description: "Quand un joueur adverse est Plaqué par ce joueur à cause d'une action de Blocage (y compris pendant une action de Blitz), ce joueur peut immédiatement commettre une action d'Agression gratuite contre le joueur Plaqué. Pour utiliser cette compétence, ce joueur doit être Debout une fois le résultat de dé de blocage choisi et appliqué, et doit occuper une case adjacente au joueur Plaqué. Après avoir utilisé cette compétence, ce joueur est Mis À Terre et son activation se termine.",
        descriptionEn: "When an opposition player is Knocked Down by this player as the result of a Block action, this player may immediately commit a free Foul action against the Knocked Down player.",
        category: "Strength"
      },
      {
        name: "Projection",
        nameEn: "Grab",
        description: "Quand ce joueur fait une action de Blocage (y compris pendant une action de Blitz), utiliser cette compétence empêche la cible de l'action de Blocage d'utiliser la compétence Glissade Contrôlée. De plus, quand ce joueur fait une action de Blocage seule (pas pendant une action de Blitz), si la cible est repoussée, ce joueur peut choisir n'importe quelle case inoccupée adjacente à la cible pour l'y repousser. S'il n'y a pas de cases inoccupées, cette compétence ne peut pas être utilisée. Un joueur ayant cette compétence ne peut pas également avoir la compétence Frénésie.",
        descriptionEn: "When this player performs a Block action, using this Skill prevents the target of the Block action from using the Sidestep skill.",
        category: "Strength"
      },
      {
        name: "Stabilité",
        nameEn: "Stand Firm",
        description: "Ce joueur peut choisir de ne pas être repoussé, que ce soit à cause d'une action de Blocage qui le cible ou d'une poussée à la chaîne. Utiliser cette compétence n'empêche pas un joueur adverse ayant la compétence Frénésie d'effectuer une seconde action de Blocage si ce joueur est encore Debout après la première.",
        descriptionEn: "This player may choose not to be pushed back, either as the result of a Block action made against them or by a chain-push.",
        category: "Strength"
      },
      {
        name: "Bras Musclé",
        nameEn: "Strong Arm",
        description: "Ce joueur peut appliquer un modificateur de +1 à ses tests de Capacité de Passe quand il fait une action de Lancer de Coéquipier. Un joueur qui n'a pas le trait Lancer de Coéquipier ne peut pas avoir cette compétence.",
        descriptionEn: "This player may apply a +1 modifier to any Passing Ability test rolls they make when performing a Throw Team-mate action.",
        category: "Strength"
      },
      {
        name: "Crâne Épais",
        nameEn: "Thick Skull",
        description: "Quand un jet de Blessure est effectué contre ce joueur (même si ce joueur est À Terre, Sonné ou a perdu sa Zone de Tacle), il peut être mis K.-O. seulement sur un jet de 9, et traite un jet de 8 comme un résultat Sonné. Si ce joueur a également le trait Minus, il peut être mis K.-O. seulement sur un jet de 8, et traite un jet de 7 comme un résultat Sonné. Les autres résultats ne sont pas affectés.",
        descriptionEn: "When an Injury roll is made against this player, they can only be KO'd on a roll of 9, and will treat a roll of 8 as a Stunned result.",
        category: "Strength"
      }
    ]
  },
  {
    name: "Traits",
    nameEn: "Traits",
    skills: [
      {
        name: "Sauvagerie Animale",
        nameEn: "Animal Savagery",
        description: "Lorsque ce joueur est activé, immédiatement après avoir déclaré l'action qu'il va effectuer mais avant d'effectuer l'action, lancez un D6, en appliquant un modificateur +2 au jet de dé si vous avez déclaré que le joueur effectuerait une action de Bloc ou de Blitz.",
        descriptionEn: "When this player is activated, immediately after declaring the action they will perform but before performing the action, roll a D6, applying a +2 modifier to the dice roll if you declared the player would perform a Block or Blitz action.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Animosité (X)",
        nameEn: "Animosity (X)",
        description: "Ce joueur est jaloux et n'aime pas certains autres joueurs de son équipe, comme indiqué entre parenthèses après le nom de la compétence sur le profil de ce joueur.",
        descriptionEn: "This player is jealous of and dislikes certain other players on their team, as shown in brackets after the name of the Skill on this player's profile.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Toujours Affamé",
        nameEn: "Always Hungry",
        description: "Si ce joueur souhaite effectuer une action de Lancer d'Équipier, lancez un D6 après qu'il ait fini de bouger, mais avant qu'il lance son équipier.",
        descriptionEn: "If this player wishes to perform a Throw Team-mate action, roll a D6 after they have finished moving, but before they throw their Team-mate.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Boule et Chaîne",
        nameEn: "Ball and Chain",
        description: "Lorsque ce joueur est activé, la seule action qu'il peut effectuer est une action Spéciale 'Mouvement de Ball & Chain'.",
        descriptionEn: "When this player is activated, the only action they may perform is a 'Ball & Chain Move' Special action.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Bombardier",
        nameEn: "Bombardier",
        description: "Lorsqu'il est activé et s'il est Debout, ce joueur peut effectuer une action Spéciale 'Lancer de Bombe'.",
        descriptionEn: "When activated and if they are Standing, this player can perform a 'Throw Bomb' Special action.",
        category: "Traits"
      },
      {
        name: "Tête de Bois",
        nameEn: "Bone Head",
        description: "Lorsque ce joueur est activé, immédiatement après avoir déclaré l'action qu'il va effectuer mais avant d'effectuer l'action, lancez un D6.",
        descriptionEn: "When this player is activated, immediately after declaring the action they will perform but before performing the action, roll a D6.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Tronçonneuse",
        nameEn: "Chainsaw",
        description: "Au lieu d'effectuer une action de Bloc, ce joueur peut effectuer une action Spéciale 'Attaque de Tronçonneuse'.",
        descriptionEn: "Instead of performing a Block action, this player may perform a 'Chainsaw Attack' Special action.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Décomposition",
        nameEn: "Decay",
        description: "Si ce joueur subit un résultat de Casualty sur la table de Blessure, il y a un modificateur +1 appliqué à tous les jets faits contre ce joueur sur la table de Casualty.",
        descriptionEn: "If this player suffers a Casualty result on the Injury table, there is a +1 modifier applied to all rolls made against this player on the Casualty table.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Regard Hypnotique",
        nameEn: "Hypnotic Gaze",
        description: "Pendant son activation, ce joueur peut effectuer une action Spéciale 'Regard Hypnotique'.",
        descriptionEn: "During their activation, this player may perform a 'Hypnotic Gaze' Special action.",
        category: "Traits"
      },
      {
        name: "Kick Team-mate",
        nameEn: "Kick Team-mate",
        description: "Une fois par tour d'équipe, en plus d'un autre joueur effectuant soit une Passe soit une action de Lancer d'Équipier, un seul joueur avec ce trait sur l'équipe active peut effectuer une action Spéciale 'Kick Team-mate'.",
        descriptionEn: "Once per team turn, in addition to another player performing either a Pass or a Throw Team-mate action, a single player with this Trait on the active team can perform a 'Kick Team-mate' Special action.",
        category: "Traits"
      },
      {
        name: "Solitaire (X+)",
        nameEn: "Loner (X+)",
        description: "Si ce joueur souhaite utiliser une relance d'équipe, lancez un D6. Si vous lancez égal ou supérieur au nombre cible indiqué entre parenthèses, ce joueur peut utiliser la relance d'équipe normalement.",
        descriptionEn: "If this player wishes to use a team re-roll, roll a D6. If you roll equal to or higher than the target number shown in brackets, this player may use the team re-roll as normal.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Pas de Mains",
        nameEn: "No Hands",
        description: "Ce joueur est incapable de prendre possession du ballon. Il ne peut pas tenter de le ramasser, de l'attraper, ou de tenter d'interférer avec une passe.",
        descriptionEn: "This player is unable to take possession of the ball. They may not attempt to pick it up, to catch it, or attempt to interfere with a pass.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Porteur de Peste",
        nameEn: "Plague Ridden",
        description: "Une fois par match, si un joueur adverse avec une caractéristique de Force de 4 ou moins qui n'a pas les traits Decay, Regeneration ou Stunty subit un résultat de Casualty de 15-16, MORT à la suite d'une action de Bloc effectuée ou d'une action de Faute commise par un joueur avec ce trait qui appartient à votre équipe.",
        descriptionEn: "Once per game, if an opposition player with a Strength characteristic of 4 or less that does not have the Decay, Regeneration or Stunty traits suffers a Casualty result of 15-16, DEAD as the result of a Block action performed or a Foul action committed by a player with this Trait that belongs to your team.",
        category: "Traits"
      },
      {
        name: "Pogo Stick",
        nameEn: "Pogo Stick",
        description: "Pendant son mouvement, au lieu de sauter par-dessus une seule case occupée par un joueur à Terre ou Étourdi, un joueur avec ce trait peut choisir de Bondir par-dessus n'importe quelle case adjacente.",
        descriptionEn: "During their movement, instead of jumping over a single square that is occupied by a Prone or Stunned player, a player with this Trait may choose to Leap over any single adjacent square.",
        category: "Traits"
      },
      {
        name: "Vomissement Projectile",
        nameEn: "Projectile Vomit",
        description: "Au lieu d'effectuer une action de Bloc, ce joueur peut effectuer une action Spéciale 'Vomissement Projectile'.",
        descriptionEn: "Instead of performing a Block action, this player may perform a 'Projectile Vomit' Special action.",
        category: "Traits"
      },
      {
        name: "Gros Débile*",
        nameEn: "Really Stupid",
        description: "Quand ce joueur est activé, même s'il est À Terre ou a perdu sa Zone de Tacle, jetez un D6 juste après avoir annoncé l'action qu'il va faire mais avant d'effectuer l'action, en appliquant un modificateur de +2 au jet si ce joueur est actuellement adjacent à un ou plusieurs coéquipiers Debout et n'ayant pas ce trait: Sur 1-3, ce joueur oublie ce qu'il était censé faire et son activation se termine immédiatement. De plus, il perd sa Zone de Tacle jusqu'à sa prochaine activation. Sur 4+, il continue normalement son activation et effectue l'action annoncée. Si vous avez annoncé que ce joueur allait faire une action qui ne peut être effectuée qu'une seule fois par tour d'équipe et si l'activation de ce joueur s'est terminée avant de pouvoir effectuer l'action, l'action est considérée comme ayant été effectuée et aucun autre joueur de votre équipe ne peut faire la même action à ce tour d'équipe.",
        descriptionEn: "When this player is activated, immediately after declaring the action they will perform but before performing the action, roll a D6, applying a +2 modifier to the dice roll if this player is currently adjacent to one or more Standing Team-mates that do not have this Trait.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Régénération",
        nameEn: "Regeneration",
        description: "Après qu'un jet de Casualty ait été fait contre ce joueur, lancez un D6. Sur un jet de 4+, le jet de Casualty est ignoré sans effet et le joueur est placé dans la boîte Réserves plutôt que dans la boîte Casualty de leur équipe.",
        descriptionEn: "After a Casualty roll has been made against this player, roll a D6. On a roll of 4+, the Casualty roll is discarded without effect and the player is placed in the Reserves box rather than the Casualty box of their team dugout.",
        category: "Traits"
      },
      {
        name: "Poids Plume*",
        nameEn: "Right Stuff",
        description: "Si ce joueur a une caractéristique de Force de 3 ou moins, il peut être lancé par un coéquipier ayant la compétence Lancer de Coéquipier, comme décrit page 52.",
        descriptionEn: "If this player also has a Strength characteristic of 3 or less, they can be thrown by a Team-mate with the Throw Team-mate skill.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Arme Secrète",
        nameEn: "Secret Weapon",
        description: "Lorsqu'une manche dans laquelle ce joueur a pris part se termine, même si ce joueur n'était pas sur le terrain à la fin de la manche, ce joueur sera Expulsé pour avoir commis une Faute.",
        descriptionEn: "When a drive in which this player took part ends, even if this player was not on the pitch at the end of the drive, this player will be Sent-off for committing a Foul.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Poignard",
        nameEn: "Stab",
        description: "Au lieu de faire une action de Blocage (y compris pendant une action de Blitz), ce joueur peut effectuer une action Spéciale de Poignard. Comme pour une action de Blocage, désignez un seul joueur Debout comme cible de l'action Spéciale de Poignard. Il n'y a pas de limite au nombre de joueurs ayant ce trait qui peuvent faire cette action Spéciale par tour d'équipe. Pour faire une action Spéciale de Poignard, faites un jet d'Armure non modifié contre le joueur ciblé: Si l'Armure du joueur touché est pénétrée, il est Mis À Terre et on effectue un jet de Blessure contre lui. Ce jet de Blessure ne peut être modifié d'aucune manière. Si l'Armure du joueur touché n'est pas pénétrée, ce trait n'a aucun effet. Si le trait Poignard est utilisé pendant une action de Blitz, le joueur ne peut plus se déplacer après l'avoir utilisé.",
        descriptionEn: "Instead of performing a Block action, this player may perform a 'Stab' Special action.",
        category: "Traits"
      },
      {
        name: "Microbe*",
        nameEn: "Stunty",
        description: "Ce joueur peut appliquer un modificateur de +1 à ses tests d'Agilité pour Esquiver. Toutefois, si un joueur adverse esquive sur une case de la Zone de Tacle de ce joueur, celui-ci ne compte pas comme Marquant le joueur en mouvement en ce qui concerne le calcul des modificateurs au test d'Agilité.",
        descriptionEn: "When this player makes an Agility test in order to Dodge, they ignore any -1 modifiers for being Marked in the square they have moved into, unless they also have either the Bombardier trait, the Chainsaw trait or the Swoop trait.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Minus*",
        nameEn: "Stunty",
        description: "Quand ce joueur fait un test d'Agilité pour Esquiver, il ignore les modificateurs de -1 dus au Marquage sur la case où il se déplace, sauf s'il a également le trait Bombardier, Tronçonneuse ou Piqué. Toutefois, quand un joueur adverse tente d'interférer avec une action de Passe effectuée par ce joueur, le joueur adverse peut appliquer un modificateur de +1 à son test d'Agilité. Enfin, les joueurs ayant ce trait sont plus susceptibles d'être blessés; quand un jet de Blessure est effectué contre ce joueur, jetez 2D6 et consultez le tableau de Blessures de Minus page 60.",
        descriptionEn: "When this player makes an Agility test in order to Dodge, they ignore any -1 modifiers for being Marked in the square they have moved into, unless they also have either the Bombardier trait, the Chainsaw trait or the Swoop trait.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Essaim",
        nameEn: "Swarming",
        description: "Pendant chaque séquence de Début de Manche, après l'Étape 2 mais avant l'Étape 3, vous pouvez retirer D3 joueurs avec ce trait de la boîte Réserves de votre équipe et les mettre en place sur le terrain.",
        descriptionEn: "During each Start of Drive sequence, after Step 2 but before Step 3, you may remove D3 players with this Trait from the Reserves box of your dugout and set them up on the pitch.",
        category: "Traits"
      },
      {
        name: "Piqué",
        nameEn: "Swoop",
        description: "Si ce joueur est lancé par un coéquipier, comme décrit page 52, il ne ricoche pas avant d'atterrir comme ce serait normalement le cas. Au lieu de cela, vous pouvez placer le gabarit de Renvoi sur le joueur, face à l'une ou l'autre Zone d'En-but ou l'une ou l'autre ligne de touche, selon votre souhait. Puis le joueur se déplace depuis la case cible de D3 cases dans la direction déterminée en jetant un D6 et en se référant au gabarit de Renvoi.",
        descriptionEn: "If this player is thrown by a Team-mate, they do not scatter before landing as they normally would.",
        category: "Traits"
      },
      {
        name: "Prendre Racine*",
        nameEn: "Take Root",
        description: "Quand ce joueur est activé, même s'il est À Terre ou a perdu sa Zone de Tacle, jetez un D6 juste après avoir annoncé l'action qu'il va faire mais avant d'effectuer l'action: Sur un jet de 1, ce joueur devient Enraciné: Un joueur Enraciné ne peut pas se déplacer hors de la case qu'il occupe quelle qu'en soit la raison, volontairement ou non, jusqu'à la fin de cette phase de jeu, ou jusqu'à ce qu'il soit Plaqué ou Mis À Terre. Un joueur Enraciné peut effectuer toute action éligible à condition qu'il puisse la faire sans se déplacer. Par exemple, un joueur Enraciné peut faire une action de Passe mais ne peut pas se déplacer avant de faire la passe. Sur 2+, ce joueur continue normalement son activation. Si vous avez annoncé que ce joueur allait faire une action qui inclut un mouvement (Passe, Transmission, Blitz ou Agression) avant qu'il devienne Enraciné, il peut effectuer l'action si c'est possible. Si c'est impossible, l'action est considérée comme ayant été effectuée et aucun autre joueur de votre équipe ne peut faire la même action à ce tour d'équipe.",
        descriptionEn: "When this player is activated, immediately after declaring the action they will perform but before performing the action, roll a D6.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Titchy",
        nameEn: "Titchy",
        description: "Ce joueur peut appliquer un modificateur +1 à tous les tests d'Agilité qu'il fait pour Esquiver.",
        descriptionEn: "This player may apply a +1 modifier to any Agility tests they make in order to Dodge.",
        category: "Traits",
        isCompulsory: true
      },
      {
        name: "Lancer de Coéquipier",
        nameEn: "Throw Team-mate",
        description: "Si ce joueur a une caractéristique de Force de 5 ou plus, il peut faire une action de Lancer de Coéquipier, comme décrit page 52, ce qui lui permet de lancer un coéquipier ayant le trait Poids Plume.",
        descriptionEn: "If this player also has a Strength characteristic of 5 or more, they may perform a Throw Team-mate action.",
        category: "Traits"
      },
      {
        name: "Timmm-ber!",
        nameEn: "Timmm-ber!",
        description: "Si ce joueur a une caractéristique de Mouvement de 2 ou moins, appliquez un modificateur de +1 au jet de dé quand il tente de se relever (comme décrit page 44) pour chaque coéquipier Debout et Démarqué auquel il est actuellement adjacent. Un jet de 1 naturel est toujours un échec, quel que soit le nombre de coéquipiers qui l'aident.",
        descriptionEn: "If this player has a Movement Allowance of 2 or less, apply a +1 modifier to the dice roll when they attempt to stand up for each Open, Standing Team-mate they are currently adjacent to.",
        category: "Traits"
      },
      {
        name: "Fureur Débridée*",
        nameEn: "Unchannelled Fury",
        description: "Quand ce joueur est activé, même s'il est À Terre ou a perdu sa Zone de Tacle, jetez un D6 juste après avoir annoncé l'action qu'il va faire mais avant d'effectuer l'action, en appliquant un modificateur de +2 au jet si vous avez annoncé une action de Blocage ou de Blitz (ou une action Spéciale accordée par un trait ou une compétence s'effectuant à la place d'une action de Blocage): Sur 1-3, il plonge dans une rage incohérente et improductive. Son activation se termine immédiatement. Sur 4+, il continue normalement son activation et effectue l'action annoncée. Si vous avez annoncé que ce joueur allait faire une action qui ne peut être effectuée qu'une seule fois par tour d'équipe et si l'activation de ce joueur s'est terminée avant de pouvoir effectuer l'action, l'action est considérée comme ayant été effectuée et aucun autre joueur de votre équipe ne peut faire la même action à ce tour d'équipe.",
        descriptionEn: "When this player is activated, immediately after declaring the action they will perform but before performing the action, roll a D6, applying a +2 modifier to the dice roll if you declared the player would perform a Block or Blitz action.",
        category: "Traits",
        isCompulsory: true
      }
    ]
  },
  {
    name: "Extraordinaires",
    nameEn: "Extraordinary",
    skills: [
      {
        name: "Frappe et Cours",
        nameEn: "Hit and Run",
        description: "Après qu'un joueur avec ce trait ait effectué une action de Bloc, il peut immédiatement bouger d'une case gratuite en ignorant les Zones de Tackle tant qu'il est toujours Debout.",
        descriptionEn: "After a player with this Trait performs a Block action, they may immediately move one free square ignoring Tackle Zones so long as they are still Standing.",
        category: "Extraordinary"
      },
      {
        name: "Ivrogne",
        nameEn: "Drunkard",
        description: "Ce joueur subit une pénalité de -1 au jet de dé lorsqu'il tente de Courir.",
        descriptionEn: "This player suffers a -1 penalty to the dice roll when attempting to Rush.",
        category: "Extraordinary"
      },
      {
        name: "Pick-me-up",
        nameEn: "Pick-me-up",
        description: "À la fin du tour d'équipe adverse, lancez un D6 pour chaque équipier à Terre et non-Étourdi dans les trois cases d'un joueur debout avec ce trait.",
        descriptionEn: "At the end of the opposition's team turn, roll a D6 for each Prone, non-Stunned team-mate within three squares of a standing player with this Trait.",
        category: "Extraordinary"
      },
      {
        name: "Soif de Sang (X+)",
        nameEn: "Bloodlust (X+)",
        description: "Pour garder le contrôle de leur esprit, les Vampires ont besoin d'un approvisionnement en sang frais. Chaque fois qu'un joueur avec ce trait s'active, après avoir déclaré son action, il doit lancer un D6.",
        descriptionEn: "To keep control of their wits, Vampires need a supply of fresh blood. Whenever a player with this trait activates, after declaring their action, they must roll a D6.",
        category: "Extraordinary"
      },
      {
        name: "Mon Ballon",
        nameEn: "My Ball",
        description: "Un joueur avec ce trait ne peut pas abandonner volontairement le ballon quand il en est en possession, et ne peut donc pas faire d'actions de Passe, d'actions de Passe à la main, ou utiliser toute autre compétence ou trait qui lui permettrait de renoncer à la possession du ballon.",
        descriptionEn: "A player with this Trait may not willingly give up the ball when in possession of it, and so may not make Pass actions, Hand-off actions, or use any other Skill or Trait that would allow them to relinquish possession of the ball.",
        category: "Extraordinary"
      },
      {
        name: "Tricheur",
        nameEn: "Trickster",
        description: "Lorsque ce joueur est sur le point d'être touché par une action de Bloc ou une action Spéciale qui remplace une action de Bloc, avant de déterminer combien de dés sont lancés, il peut être retiré du terrain et placé dans n'importe quelle autre case inoccupée adjacente au joueur effectuant l'action de Bloc.",
        descriptionEn: "When this player is about to be hit by a Block action or a Special action that replaces a Block action, before determining how many dice are rolled, they may be removed from the pitch and placed in any other unoccupied square adjacent to the player performing the Block action.",
        category: "Extraordinary"
      },
      {
        name: "Souffle de Feu",
        nameEn: "Breathe Fire",
        description: "Une fois par activation, au lieu d'effectuer une action de Bloc, ce joueur peut effectuer une action Spéciale Souffle de Feu.",
        descriptionEn: "Once per activation, instead of performing a Block action, this player may perform a Breathe Fire Special action.",
        category: "Extraordinary"
      }
    ]
  }
];

export default function SkillsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { language, t } = useLanguage();

  // Filtrer les compétences basé sur la recherche et la catégorie
  const filteredData = useMemo(() => {
    let filtered = skillsData;

    // Filtrer par catégorie si sélectionnée
    if (selectedCategory) {
      filtered = filtered.filter(category => category.name === selectedCategory);
    }

    // Filtrer par terme de recherche
    if (searchTerm) {
      filtered = filtered.map(category => ({
        ...category,
        skills: category.skills.filter(skill =>
          skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          skill.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
          skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          skill.descriptionEn.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })).filter(category => category.skills.length > 0);
    }

    return filtered;
  }, [searchTerm, selectedCategory]);

  const categories = skillsData.map(category => category.name);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {t.skills.title}
        </h1>
        <p className="text-gray-600 mb-6">
          {t.skills.description}
        </p>

        {/* Barre de recherche */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder={t.skills.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filtres par catégorie */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t.skills.allCategories}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {language === "fr" ? category : skillsData.find(c => c.name === category)?.nameEn}
              </button>
            ))}
          </div>
        </div>

        {/* Statistiques */}
        <div className="mb-6 text-sm text-gray-600">
          {searchTerm || selectedCategory ? (
            <>
              {filteredData.reduce((total, category) => total + category.skills.length, 0)} {t.skills.resultsFound}
              {searchTerm && ` ${t.skills.for} "${searchTerm}"`}
              {selectedCategory && ` ${t.skills.in} "${language === "fr" ? selectedCategory : skillsData.find(c => c.name === selectedCategory)?.nameEn}"`}
            </>
          ) : (
            t.skills.total.replace("{count}", skillsData.reduce((total, category) => total + category.skills.length, 0).toString())
          )}
        </div>
      </div>

      {/* Liste des compétences par catégorie */}
      <div className="space-y-8">
        {filteredData.map((category) => (
          <div key={category.name} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {language === "fr" ? category.name : category.nameEn}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {category.skills.length} {category.skills.length === 1 ? t.footer.items : t.footer.itemsPlural}
              </p>
            </div>
            <div className="p-6">
              <div className="grid gap-4">
                {category.skills.map((skill) => (
                  <div key={skill.name} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {language === "fr" 
                            ? `${skill.name} (${skill.nameEn})` 
                            : `${skill.nameEn} (${skill.name})`
                          }
                          {skill.isCompulsory && (
                            <span className="ml-2 text-red-600 text-sm font-normal">
                              ({t.footer.compulsory})
                            </span>
                          )}
                        </h3>
                        <p className="text-gray-700 leading-relaxed">
                          {language === "fr" ? skill.description : skill.descriptionEn}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          skill.category === "General" ? "bg-blue-100 text-blue-800" :
                          skill.category === "Agility" ? "bg-green-100 text-green-800" :
                          skill.category === "Strength" ? "bg-red-100 text-red-800" :
                          skill.category === "Passing" ? "bg-purple-100 text-purple-800" :
                          skill.category === "Mutations" ? "bg-orange-100 text-orange-800" :
                          skill.category === "Traits" ? "bg-gray-100 text-gray-800" :
                          skill.category === "Extraordinary" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {skill.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredData.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">
            {language === "fr" ? "Aucun résultat trouvé pour votre recherche." : "No results found for your search."}
          </div>
          <p className="text-gray-400 mt-2">
            {language === "fr" ? "Essayez de modifier vos critères de recherche." : "Try modifying your search criteria."}
          </p>
        </div>
      )}

      {/* Légende des couleurs */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{language === "fr" ? "Légende des couleurs" : "Color Legend"}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></span>
            <span className="text-gray-700">General</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-green-100 border border-green-300 rounded"></span>
            <span className="text-gray-700">Agility</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-red-100 border border-red-300 rounded"></span>
            <span className="text-gray-700">Strength</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></span>
            <span className="text-gray-700">Passing</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></span>
            <span className="text-gray-700">Mutations</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></span>
            <span className="text-gray-700">Traits</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></span>
            <span className="text-gray-700">Extraordinary</span>
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          {language === "fr" 
            ? "Les compétences marquées " 
            : "Skills marked "
          }
          <span className="text-red-600 font-semibold">
            ({language === "fr" ? "Obligatoire" : "Compulsory"})
          </span>
          {language === "fr" 
            ? " doivent être utilisées quand les conditions sont remplies."
            : " must be used when conditions are met."
          }
        </div>
      </div>
    </div>
  );
}