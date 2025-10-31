// Accès connus par slug de position. Cette table peut être enrichie au fil du temps.
const ACCESS_BY_POSITION = {
    // Skaven
    skaven_lineman: { primary: ["General"], secondary: ["Agility", "Mutation", "Passing", "Strength"] },
    skaven_thrower: { primary: ["General", "Passing"], secondary: ["Agility", "Mutation", "Strength"] },
    skaven_blitzer: { primary: ["General", "Strength"], secondary: ["Agility", "Mutation", "Passing"] },
    skaven_gutter_runner: { primary: ["Agility"], secondary: ["General", "Mutation", "Passing", "Strength"] },
    skaven_rat_ogre: { primary: ["Strength"], secondary: ["General", "Mutation"] },
    // Wood Elf
    wood_elf_lineman: { primary: ["General"], secondary: ["Agility", "Passing", "Strength"] },
    wood_elf_thrower: { primary: ["General", "Passing"], secondary: ["Agility", "Strength"] },
    wood_elf_catcher: { primary: ["Agility"], secondary: ["General", "Passing", "Strength"] },
    wood_elf_wardancer: { primary: ["General", "Agility"], secondary: ["Passing", "Strength"] },
    // Lizardmen
    lizardmen_saurus: { primary: ["Strength"], secondary: ["General"] },
    lizardmen_skink_runner: { primary: ["Agility"], secondary: ["General", "Passing"] },
    lizardmen_chameleon_skink: { primary: ["Agility", "Passing"], secondary: ["General"] },
};
const ALL_CATEGORIES = ["General", "Agility", "Strength", "Passing", "Mutation", "Trait"];
export function getPositionCategoryAccess(positionSlug) {
    return ACCESS_BY_POSITION[positionSlug] || { primary: ALL_CATEGORIES, secondary: ALL_CATEGORIES };
}
