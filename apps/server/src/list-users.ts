import { prisma } from "./prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, createdAt: true },
  });
  console.log(JSON.stringify(users, null, 2));
}

main().then(() => prisma.$disconnect());
