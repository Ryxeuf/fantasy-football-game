import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

async function main() {
  const users = [
    { email: "admin@example.com", name: "Admin", role: "admin", password: "admin123" },
    { email: "user@example.com", name: "User", role: "user", password: "user123" },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) continue;
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({ data: { email: u.email, name: u.name, role: u.role, passwordHash } });
  }

  // Créer 2 équipes par défaut par utilisateur: skaven et lizardmen
  const allUsers = await prisma.user.findMany();
  for (const u of allUsers) {
    const existingTeams = await prisma.team.findMany({ where: { ownerId: u.id } });
    if (existingTeams.length >= 2) continue;
    const teamA = await prisma.team.create({ data: { ownerId: u.id, name: `${u.name || u.email}-Skavens`, roster: 'skaven' } });
    const teamB = await prisma.team.create({ data: { ownerId: u.id, name: `${u.name || u.email}-Lizardmen`, roster: 'lizardmen' } });
    // joueurs minimalistes placeholder (11 linemen), les rosters détaillés viendront du moteur
    const mk = (teamId: string, i: number) => ({ teamId, name: `J${i}`, position: 'Lineman', number: i, ma: 6, st: 3, ag: 3, pa: 3, av: 9, skills: '' });
    await prisma.teamPlayer.createMany({ data: Array.from({ length: 11 }, (_, i) => mk(teamA.id, i + 1)) });
    await prisma.teamPlayer.createMany({ data: Array.from({ length: 11 }, (_, i) => mk(teamB.id, i + 1)) });
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


