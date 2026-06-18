import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const lcs = await prisma.letterOfCredit.findMany();
  console.log("Current Letters of Credit in Database:");
  console.log(JSON.stringify(lcs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
