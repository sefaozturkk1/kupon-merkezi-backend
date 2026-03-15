// Demo/test verilerini temizle
const { PrismaClient } = require('@prisma/client');

async function cleanDatabase() {
  const prisma = new PrismaClient();

  try {
    console.log('🧹 Veritabanı temizleniyor...\n');

    // Sırayla tüm tabloları temizle (foreign key kısıtlamaları için sıra önemli)
    const deletedShares = await prisma.couponShare.deleteMany({});
    console.log(`  ✅ CouponShare: ${deletedShares.count} kayıt silindi`);

    const deletedPlayed = await prisma.playedCoupon.deleteMany({});
    console.log(`  ✅ PlayedCoupon: ${deletedPlayed.count} kayıt silindi`);

    const deletedSelections = await prisma.couponSelection.deleteMany({});
    console.log(`  ✅ CouponSelection: ${deletedSelections.count} kayıt silindi`);

    const deletedCoupons = await prisma.coupon.deleteMany({});
    console.log(`  ✅ Coupon: ${deletedCoupons.count} kayıt silindi`);

    const deletedStats = await prisma.userStatistic.deleteMany({});
    console.log(`  ✅ UserStatistic: ${deletedStats.count} kayıt silindi`);

    const deletedAnnouncements = await prisma.announcement.deleteMany({});
    console.log(`  ✅ Announcement: ${deletedAnnouncements.count} kayıt silindi`);

    // Community üyelikleri sil
    try {
      const deletedMembers = await prisma.communityMember.deleteMany({});
      console.log(`  ✅ CommunityMember: ${deletedMembers.count} kayıt silindi`);
    } catch (e) {}

    const deletedCommunities = await prisma.community.deleteMany({});
    console.log(`  ✅ Community: ${deletedCommunities.count} kayıt silindi`);

    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`  ✅ User: ${deletedUsers.count} kayıt silindi`);

    console.log('\n🎉 Tüm demo veriler başarıyla silindi!');
    console.log('ℹ️  Uygulama temiz veritabanıyla çalışacak.');
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
