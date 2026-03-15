const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users:', users.length);
  const coupons = await prisma.coupon.findMany({ include: { selections: true }, orderBy: { createdAt: 'desc' }, take: 1 });
  console.log('Latest Coupon:', JSON.stringify(coupons, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
