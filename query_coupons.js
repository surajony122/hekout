const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const coupons = await prisma.coupon.findMany();
  console.log("All coupons:", coupons);
  const merchants = await prisma.merchant.findMany();
  console.log("All merchants:", merchants.map(m => m.shopDomain));
}
main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
