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


