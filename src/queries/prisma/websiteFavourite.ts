import { uuid } from '@/lib/crypto';
import prisma from '@/lib/prisma';

export async function getWebsiteFavouriteIds(userId: string, websiteIds: string[]) {
  if (!userId || websiteIds.length === 0) {
    return [];
  }

  const favourites = await prisma.client.websiteFavourite.findMany({
    where: {
      userId,
      websiteId: { in: websiteIds },
    },
    select: {
      websiteId: true,
    },
  });

  return favourites.map(favourite => favourite.websiteId);
}

export async function createWebsiteFavourite(userId: string, websiteId: string) {
  return prisma.client.websiteFavourite.create({
    data: {
      id: uuid(),
      userId,
      websiteId,
    },
  });
}

export async function deleteWebsiteFavourite(userId: string, websiteId: string) {
  return prisma.client.websiteFavourite.deleteMany({
    where: {
      userId,
      websiteId,
    },
  });
}
