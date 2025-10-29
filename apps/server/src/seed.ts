import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

async function main() {
  const users = [
    {
      email: "admin@example.com",
      name: "Admin",
      role: "admin",
      password: "admin123",
    },
    {
      email: "user@example.com",
      name: "User",
      role: "user",
      password: "user123",
    },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email },
    });
    if (existing) continue;
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: { email: u.email, name: u.name, role: u.role, passwordHash },
    });
  }

  // Créer 2 équipes par défaut par utilisateur: skaven et lizardmen
  const allUsers = await prisma.user.findMany();
  for (const u of allUsers) {
    const existingTeams = await prisma.team.findMany({
      where: { ownerId: u.id },
    });
    if (existingTeams.length >= 2) continue;
    const teamA = await prisma.team.create({
      data: {
        ownerId: u.id,
        name: `${u.name || u.email}-Skavens`,
        roster: "skaven",
      },
    });
    const teamB = await prisma.team.create({
      data: {
        ownerId: u.id,
        name: `${u.name || u.email}-Lizardmen`,
        roster: "lizardmen",
      },
    });
    // Créer une équipe Skaven réaliste : 1 Rat Ogre, 2 Blitzers, 2 Gutter Runners, 1 Thrower, 6 Linemen
    const skavenPlayers = [
      // 1 Rat Ogre
      {
        teamId: teamA.id,
        name: "Rat Ogre",
        position: "skaven_rat_ogre",
        number: 1,
        ma: 6,
        st: 5,
        ag: 5,
        pa: 6,
        av: 9,
        skills: "animal-savagery,frenzy,loner-4,mighty-blow-1,prehensile-tail",
      },
      // 2 Blitzers
      {
        teamId: teamA.id,
        name: "Blitzer 1",
        position: "skaven_blitzer",
        number: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "block",
      },
      {
        teamId: teamA.id,
        name: "Blitzer 2",
        position: "skaven_blitzer",
        number: 3,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "block",
      },
      // 2 Gutter Runners
      {
        teamId: teamA.id,
        name: "Gutter Runner 1",
        position: "skaven_gutter_runner",
        number: 4,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "dodge",
      },
      {
        teamId: teamA.id,
        name: "Gutter Runner 2",
        position: "skaven_gutter_runner",
        number: 5,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "dodge",
      },
      // 1 Thrower
      {
        teamId: teamA.id,
        name: "Thrower",
        position: "skaven_thrower",
        number: 6,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 2,
        av: 8,
        skills: "pass,sure-hands",
      },
      // 6 Linemen
      ...Array.from({ length: 6 }, (_, i) => ({
        teamId: teamA.id,
        name: `Lineman ${i + 1}`,
        position: "skaven_lineman",
        number: i + 7,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "",
      })),
    ];

    // Équipe Lizardmen (11 linemen placeholder)
    const mk = (teamId: string, i: number) => ({
      teamId,
      name: `J${i}`,
      position: "Lineman",
      number: i,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 3,
      av: 9,
      skills: "",
    });

    await prisma.teamPlayer.createMany({
      data: skavenPlayers,
    });
    await prisma.teamPlayer.createMany({
      data: Array.from({ length: 11 }, (_, i) => mk(teamB.id, i + 1)),
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed terminé: comptes par défaut prêts.");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
