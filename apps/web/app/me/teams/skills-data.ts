export interface SkillDescription {
  name: string;
  description: string;
  category: string;
}

export const SKILLS_DESCRIPTIONS: Record<string, SkillDescription> = {
  // GENERAL SKILLS
  "Block": {
    name: "Block",
    description: "When a Both Down result is applied during a Block action, this player may choose to ignore it and not be Knocked Down.",
    category: "General"
  },
  "Dauntless": {
    name: "Dauntless",
    description: "When this player performs a Block action, if the nominated target has a higher Strength characteristic than this player, roll a D6 and add this player's Strength characteristic to the result. If the total is higher than the target's Strength characteristic, this player increases their Strength characteristic to be equal to that of the target for the duration of this Block action.",
    category: "General"
  },
  "Dirty Player": {
    name: "Dirty Player",
    description: "When this player commits a Foul action, either the Armour roll or Injury roll made against the victim may be modified by +1. This modifier may be applied after the roll has been made.",
    category: "General"
  },
  "Fend": {
    name: "Fend",
    description: "If this player is pushed back as the result of any block dice result being applied against them, they may choose to prevent the player that pushed them back from following-up.",
    category: "General"
  },
  "Frenzy": {
    name: "Frenzy",
    description: "Every time this player performs a Block action, they must follow-up if the target is pushed back and if they are able. If the target is still Standing after being pushed back, this player must then perform a second Block action against the same target.",
    category: "General"
  },
  "Kick": {
    name: "Kick",
    description: "If this player is nominated to be the kicking player during a kick-off, you may choose to halve the result of the D6 to determine the number of squares that the ball deviates, rounding any fractions down.",
    category: "General"
  },
  "Pro": {
    name: "Pro",
    description: "During their activation, this player may attempt to re-roll one dice. Roll a D6: on a roll of 3+, the dice can be re-rolled; on a roll of 1 or 2, the dice cannot be re-rolled.",
    category: "General"
  },
  "Shadowing": {
    name: "Shadowing",
    description: "This player can use this Skill when an opposition player they are Marking voluntarily moves out of a square within this player's Tackle Zone. Roll a D6, adding the MA of this player to the roll and then subtracting the MA of the opposition player. If the result is 6 or higher, this player may immediately move into the square vacated by the opposition player.",
    category: "General"
  },
  "Strip Ball": {
    name: "Strip Ball",
    description: "When this player targets an opposition player that is in possession of the ball with a Block action, choosing to apply a Push Back result will cause that player to drop the ball in the square they are pushed back into.",
    category: "General"
  },
  "Sure Hands": {
    name: "Sure Hands",
    description: "This player may re-roll any failed attempt to pick up the ball. In addition, the Strip Ball skill cannot be used against a player with this Skill.",
    category: "General"
  },
  "Tackle": {
    name: "Tackle",
    description: "When an active opposition player attempts to Dodge from a square in which they were being Marked by one or more players on your team with this Skill, that player cannot use the Dodge skill.",
    category: "General"
  },
  "Wrestle": {
    name: "Wrestle",
    description: "This player may use this Skill when a Both Down result is applied, either when they perform a Block action or when they are the target of a Block action. Instead of applying the Both Down result as normal, both players are Placed Prone.",
    category: "General"
  },

  // AGILITY SKILLS
  "Catch": {
    name: "Catch",
    description: "This player may re-roll a failed Agility test when attempting to catch the ball.",
    category: "Agility"
  },
  "Diving Catch": {
    name: "Diving Catch",
    description: "This player may attempt to catch the ball if a pass, throw-in or kick-off causes it to land in a square within their Tackle Zone after scattering or deviating. Additionally, this player may apply a +1 modifier to any attempt to catch an accurate pass if they occupy the target square.",
    category: "Agility"
  },
  "Diving Tackle": {
    name: "Diving Tackle",
    description: "Should an active opposition player that is attempting to Dodge, Jump or Leap in order to vacate a square in which they are being Marked by this player pass their Agility test, you may declare that this player will use this Skill. Your opponent must immediately subtract 2 from the result of the Agility test.",
    category: "Agility"
  },
  "Dodge": {
    name: "Dodge",
    description: "Once per team turn, during their activation, this player may re-roll a failed Agility test when attempting to Dodge. Additionally, this player may choose to use this Skill when they are the target of a Block action and a Stumble result is applied against them.",
    category: "Agility"
  },
  "Defensive": {
    name: "Defensive",
    description: "During your opponent's team turn (but not during your own team turn), any opposition players being Marked by this player cannot use the Guard skill.",
    category: "Agility"
  },
  "Jump Up": {
    name: "Jump Up",
    description: "If this player is Prone they may stand up for free. Additionally, if this player is Prone when activated, they may attempt to Jump Up and perform a Block action. This player makes an Agility test, applying a +1 modifier.",
    category: "Agility"
  },
  "Leap": {
    name: "Leap",
    description: "During their movement, instead of jumping over a single square that is occupied by a Prone or Stunned player, a player with this Skill may choose to Leap over any single adjacent square, including unoccupied squares and squares occupied by Standing players.",
    category: "Agility"
  },
  "Safe Pair of Hands": {
    name: "Safe Pair of Hands",
    description: "If this player is Knocked Down or Placed Prone whilst in possession of the ball, the ball does not bounce. Instead, you may place the ball in an unoccupied square adjacent to the one this player occupies when they become Prone.",
    category: "Agility"
  },
  "Sidestep": {
    name: "Sidestep",
    description: "If this player is pushed back for any reason, they are not moved into a square chosen by the opposing coach. Instead you may choose any unoccupied square adjacent to this player.",
    category: "Agility"
  },
  "Sneaky Git": {
    name: "Sneaky Git",
    description: "When this player performs a Foul action, they are not Sent-off for committing a Foul should they roll a natural double on the Armour roll. Additionally, the activation of this player does not have to end once the Foul has been committed.",
    category: "Agility"
  },
  "Sprint": {
    name: "Sprint",
    description: "When this player performs any action that includes movement, they may attempt to Rush three times, rather than the usual two.",
    category: "Agility"
  },
  "Sure Feet": {
    name: "Sure Feet",
    description: "Once per team turn, during their activation, this player may re-roll the D6 when attempting to Rush.",
    category: "Agility"
  },

  // MUTATIONS
  "Big Hand": {
    name: "Big Hand",
    description: "This player may ignore any modifier(s) for being Marked or for Pouring Rain weather conditions when they attempt to pick up the ball.",
    category: "Mutation"
  },
  "Claws": {
    name: "Claws",
    description: "When you make an Armour roll against an opposition player that was Knocked Down as the result of a Block action performed by this player, a roll of 8+ before applying any modifiers will break their armour, regardless of their actual Armour Value.",
    category: "Mutation"
  },
  "Disturbing Presence": {
    name: "Disturbing Presence",
    description: "When an opposition player performs either a Pass action, a Throw Team-mate action or a Throw Bomb Special action, or attempts to either interfere with a pass or to catch the ball, they must apply a -1 modifier to the test for each player on your team with this Skill that is within three squares of them.",
    category: "Mutation"
  },
  "Extra Arms": {
    name: "Extra Arms",
    description: "This player may apply a +1 modifier when they attempt to pick up or catch the ball, or when they attempt to interfere with a pass.",
    category: "Mutation"
  },
  "Foul Appearance": {
    name: "Foul Appearance",
    description: "When an opposition player declares a Block action targeting this player, their coach must first roll a D6. On a roll of 1, the player cannot perform the declared action and the action is wasted.",
    category: "Mutation"
  },
  "Horns": {
    name: "Horns",
    description: "When this player performs a Block action as part of a Blitz action (but not on its own), you may apply a +1 modifier to this player's Strength characteristic.",
    category: "Mutation"
  },
  "Iron Hard Skin": {
    name: "Iron Hard Skin",
    description: "The Claws skill cannot be used when making an Armour roll against this player. Opposing players cannot modify any Armour rolls made against this player.",
    category: "Mutation"
  },
  "Monstrous Mouth": {
    name: "Monstrous Mouth",
    description: "This player may re-roll any failed attempt to catch the ball. In addition, the Strip Ball skill cannot be used against this player.",
    category: "Mutation"
  },
  "Prehensile Tail": {
    name: "Prehensile Tail",
    description: "When an active opposition player attempts to Dodge, Jump or Leap in order to vacate a square in which they are being Marked by this player, there is an additional -1 modifier applied to the active player's Agility test.",
    category: "Mutation"
  },
  "Tentacles": {
    name: "Tentacles",
    description: "This player can use this Skill when an opposition player they are Marking voluntarily moves out of a square within this player's Tackle Zone. Roll a D6, adding the ST of this player to the roll and then subtracting the ST of the opposition player. If the result is 6 or higher, the opposition player is held firmly in place and their movement comes to an end.",
    category: "Mutation"
  },
  "Two Heads": {
    name: "Two Heads",
    description: "This player may apply a +1 modifier to the Agility test when they attempt to Dodge.",
    category: "Mutation"
  },
  "Very Long Legs": {
    name: "Very Long Legs",
    description: "This player may reduce any negative modifier applied to the Agility test when they attempt to Jump over a Prone or Stunned player by 1, to a minimum of -1. Additionally, this player may apply a +2 modifier to any attempts to interfere with a pass they make.",
    category: "Mutation"
  },

  // PASSING SKILLS
  "Accurate": {
    name: "Accurate",
    description: "When this player performs a Quick Pass action or a Short Pass action, you may apply an additional +1 modifier to the Passing Ability test.",
    category: "Passing"
  },
  "Cannoneer": {
    name: "Cannoneer",
    description: "When this player performs a Long Pass action or a Long Bomb Pass action, you may apply an additional +1 modifier to the Passing Ability test.",
    category: "Passing"
  },
  "Cloud Burster": {
    name: "Cloud Burster",
    description: "When this player performs a Long Pass action or a Long Bomb Pass action, you may choose to make the opposing coach re-roll a successful attempt to interfere with the pass.",
    category: "Passing"
  },
  "Dump-off": {
    name: "Dump-off",
    description: "If this player is nominated as the target of a Block action and if they are in possession of the ball, they may immediately perform a Quick Pass action, interrupting the activation of the opposition player performing the Block action.",
    category: "Passing"
  },
  "Fumblerooskie": {
    name: "Fumblerooskie",
    description: "When this player performs a Move or Blitz action whilst in possession of the ball, they may choose to 'drop' the ball. The ball may be placed in any square the player vacates during their movement and does not bounce.",
    category: "Passing"
  },
  "Hail Mary Pass": {
    name: "Hail Mary Pass",
    description: "When this player performs a Pass action, the target square can be anywhere on the pitch and the range ruler does not need to be used. A Hail Mary pass is never accurate, regardless of the result of the Passing Ability test.",
    category: "Passing"
  },
  "Leader": {
    name: "Leader",
    description: "A team which has one or more players with this Skill gains a single extra team re-roll, called a Leader re-roll. However, the Leader re-roll can only be used if there is at least one player with this Skill on the pitch.",
    category: "Passing"
  },
  "Nerves of Steel": {
    name: "Nerves of Steel",
    description: "This player may ignore any modifier(s) for being Marked when they attempt to perform a Pass action, attempt to catch the ball or attempt to interfere with a pass.",
    category: "Passing"
  },
  "On the Ball": {
    name: "On the Ball",
    description: "This player may move up to three squares when the opposing coach declares that one of their players is going to perform a Pass action. This move is made after the range has been measured and the target square declared, but before the active player makes a Passing Ability test.",
    category: "Passing"
  },
  "Pass": {
    name: "Pass",
    description: "This player may re-roll a failed Passing Ability test when performing a Pass action.",
    category: "Passing"
  },
  "Running Pass": {
    name: "Running Pass",
    description: "If this player performs a Quick Pass action, their activation does not have to end once the pass is resolved. If you wish and if this player has not used their full Movement Allowance, they may continue to move after resolving the pass.",
    category: "Passing"
  },
  "Safe Pass": {
    name: "Safe Pass",
    description: "Should this player fumble a Pass action, the ball is not dropped, does not bounce from the square this player occupies, and no Turnover is caused. Instead, this player retains possession of the ball and their activation ends.",
    category: "Passing"
  },

  // STRENGTH SKILLS
  "Arm Bar": {
    name: "Arm Bar",
    description: "If an opposition player Falls Over as the result of failing their Agility test when attempting to Dodge, Jump or Leap out of a square in which they were being Marked by this player, you may apply a +1 modifier to either the Armour roll or Injury roll.",
    category: "Strength"
  },
  "Brawler": {
    name: "Brawler",
    description: "When this player performs a Block action on its own (but not as part of a Blitz action), this player may re-roll a single Both Down result.",
    category: "Strength"
  },
  "Break Tackle": {
    name: "Break Tackle",
    description: "Once during their activation, after making an Agility test in order to Dodge, this player may modify the dice roll by +1 if their Strength characteristic is 4 or less, or by +2 if their Strength characteristic is 5 or more.",
    category: "Strength"
  },
  "Grab": {
    name: "Grab",
    description: "When this player performs a Block action, they may choose to apply a Push Back result to any square adjacent to the target, rather than the square the target was pushed back into.",
    category: "Strength"
  },
  "Guard": {
    name: "Guard",
    description: "This player may use this Skill when an opposition player performs a Block action against a team-mate that is adjacent to this player. This player may assist the team-mate for the purposes of that Block action.",
    category: "Strength"
  },
  "Juggernaut": {
    name: "Juggernaut",
    description: "When this player performs a Block action, they may choose to treat a Both Down result as a Push Back result instead.",
    category: "Strength"
  },
  "Mighty Blow": {
    name: "Mighty Blow",
    description: "When an opposition player is Knocked Down as the result of a Block action performed by this player, you may apply a +1 modifier to either the Armour roll or Injury roll made against them.",
    category: "Strength"
  },
  "Multiple Block": {
    name: "Multiple Block",
    description: "When this player performs a Block action, they may target two adjacent opposition players instead of one. Both targets must be adjacent to this player and to each other.",
    category: "Strength"
  },
  "Pile Driver": {
    name: "Pile Driver",
    description: "When an opposition player is Knocked Down as the result of a Block action performed by this player, you may apply a +1 modifier to the Injury roll made against them.",
    category: "Strength"
  },
  "Stand Firm": {
    name: "Stand Firm",
    description: "This player may choose not to be pushed back as the result of a Block action. If they choose not to be pushed back, they are Placed Prone instead.",
    category: "Strength"
  },
  "Strong Arm": {
    name: "Strong Arm",
    description: "When this player performs a Pass action, you may reduce the range by one step (e.g., a Long Pass becomes a Short Pass).",
    category: "Strength"
  },
  "Thick Skull": {
    name: "Thick Skull",
    description: "When this player is Knocked Down, you may apply a +1 modifier to the Injury roll made against them.",
    category: "Strength"
  },

  // TRAITS
  "Animal Savagery": {
    name: "Animal Savagery",
    description: "At the start of this player's activation, roll a D6. On a roll of 1, this player must perform a Block action against a random adjacent team-mate if one is present.",
    category: "Trait"
  },
  "Bone Head": {
    name: "Bone Head",
    description: "At the start of this player's activation, roll a D6. On a roll of 1, this player cannot perform any actions and their activation ends immediately.",
    category: "Trait"
  },
  "Really Stupid": {
    name: "Really Stupid",
    description: "At the start of this player's activation, roll a D6. On a roll of 1, this player cannot perform any actions and their activation ends immediately.",
    category: "Trait"
  },
  "Regeneration": {
    name: "Regeneration",
    description: "When this player is removed from play as the result of an Injury roll, roll a D6. On a roll of 4+, this player is not removed from play and may return to play later in the match.",
    category: "Trait"
  },
  "Right Stuff": {
    name: "Right Stuff",
    description: "This player may be thrown by a team-mate with the Throw Team-mate skill.",
    category: "Trait"
  },
  "Stunty": {
    name: "Stunty",
    description: "This player may Dodge on a roll of 2+ instead of 3+. However, this player may not use the Dodge skill.",
    category: "Trait"
  },
  "Swarming": {
    name: "Swarming",
    description: "This player may be placed on the pitch at the start of the match even if doing so would exceed the maximum number of players allowed on the pitch.",
    category: "Trait"
  },
  "Take Root": {
    name: "Take Root",
    description: "At the start of this player's activation, roll a D6. On a roll of 1, this player cannot perform any actions and their activation ends immediately.",
    category: "Trait"
  },
  "Titchy": {
    name: "Titchy",
    description: "This player may Dodge on a roll of 2+ instead of 3+. However, this player may not use the Dodge skill.",
    category: "Trait"
  }
};

export function getSkillDescription(skillName: string): SkillDescription | null {
  return SKILLS_DESCRIPTIONS[skillName] || null;
}

export function parseSkills(skillsString: string): string[] {
  if (!skillsString || skillsString.trim() === "") {
    return [];
  }
  return skillsString.split(",").map(skill => skill.trim()).filter(skill => skill.length > 0);
}
