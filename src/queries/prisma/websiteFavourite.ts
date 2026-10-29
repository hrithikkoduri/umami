import prisma from '@/lib/prisma';

export async function favouriteWebsite(websiteId: string, userId: string) {
  // skipDuplicates, not upsert: a single INSERT ... ON CONFLICT DO NOTHING stays
  // atomic when the star is double-clicked, so no duplicate-key error escapes.
  await prisma.client.websiteFavourite.createMany({
    data: [{ userId, websiteId }],
    skipDuplicates: true,
  });

  return prisma.client.websiteFavourite.findUnique({
    where: { userId_websiteId: { userId, websiteId } },
    select: {
      userId: true,
      websiteId: true,
      createdAt: true,
    },
  });
}

export async function unfavouriteWebsite(websiteId: string, userId: string) {
  const { count } = await prisma.client.websiteFavourite.deleteMany({
    where: { websiteId, userId },
  });

  return count;
}

export async function getFavouriteWebsiteIds(userId: string) {
  const favourites = await prisma.client.websiteFavourite.findMany({
    where: { userId },
    select: { websiteId: true },
  });

  return new Set(favourites.map(({ websiteId }) => websiteId));
}
