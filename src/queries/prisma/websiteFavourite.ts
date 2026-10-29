import prisma from '@/lib/prisma';

export async function favouriteWebsite(websiteId: string, userId: string) {
  // A double-clicked star must not raise a duplicate-key error; skipDuplicates makes the
  // duplicate insert a no-op whatever statement Prisma chooses for it.
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

  return favourites.map(({ websiteId }) => websiteId);
}
