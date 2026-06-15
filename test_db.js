const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const coupons = await prisma.coupon.findMany();
  console.dir(coupons, { depth: null });
}
run().catch(console.error).finally(() => prisma.$disconnect());
