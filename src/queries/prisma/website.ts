import { z } from 'zod';
import type { Prisma, Website } from '@/generated/prisma/client';
import { DEFAULT_PAGE_SIZE, ROLES } from '@/lib/constants';
import prisma, { getSchema } from '@/lib/prisma';
import redis from '@/lib/redis';
import { sanitizeSortFilters } from '@/lib/sort';
import type { PageResult, QueryFilters } from '@/lib/types';
import { getWebsiteFavouriteIds } from './websiteFavourite';

const WEBSITE_SORT_FIELDS = ['name', 'domain', 'createdAt'] as const;

export type WebsiteListItem = Website & {
  shareId: string | null;
  favourite: boolean;
  user?: { id: string; username: string } | null;
  createUser?: { id: string; username: string } | null;
  team?: {
    members: { userId: string; role: string }[];
  } | null;
};

async function deleteWebsiteDependentData(tx: any, websiteId: string) {
  await tx.sessionReplaySaved.deleteMany({
    where: { websiteId },
  });

  // Favourites are personal bookmarks, but a reset drops them alongside saved
  // replays so the website's per-user state never outlives its data.
  await tx.websiteFavourite.deleteMany({
    where: { websiteId },
  });

  await tx.sessionReplay.deleteMany({
    where: { websiteId },
  });

  await tx.heatmapEvent.deleteMany({
    where: { websiteId },
  });

  await tx.revenue.deleteMany({
    where: { websiteId },
  });

  await tx.eventData.deleteMany({
    where: { websiteId },
  });

  // Follow the real EventData -> WebsiteEvent dependency to clean up any legacy rows
  // whose duplicated websiteId drifted from the parent event row.
  const schema = getSchema();

  if (schema) {
    await tx.$executeRawUnsafe(`SET search_path TO "${schema}";`);
  }

  await tx.$executeRawUnsafe(
    `
      delete from event_data
      using website_event
      where event_data.website_event_id = website_event.event_id
        and website_event.website_id = $1
    `,
    websiteId,
  );

  await tx.sessionData.deleteMany({
    where: { websiteId },
  });

  await tx.sessionLink.deleteMany({
    where: { websiteId },
  });

  await tx.websiteEvent.deleteMany({
    where: { websiteId },
  });

  await tx.session.deleteMany({
    where: { websiteId },
  });
}

export async function findWebsite(criteria: Prisma.WebsiteFindUniqueArgs) {
  return prisma.client.website.findUnique(criteria);
}

export async function getWebsite(websiteId: string) {
  if (!z.uuid().safeParse(websiteId).success) {
    return null;
  }

  const website = await findWebsite({
    where: {
      id: websiteId,
    },
  });

  if (!website) {
    return null;
  }

  return attachShareIdToWebsite(website);
}

const DEFAULT_WEBSITE_SORT_FIELD = 'name';

function getWebsiteOrderBy(
  filters: QueryFilters,
): Prisma.WebsiteOrderByWithRelationInput[] | undefined {
  const { orderBy, sortDescending = false } = filters;
  const direction = sortDescending ? 'desc' : 'asc';

  // Absent means the caller supplied no (or no whitelisted) sort, in which case the
  // ordering it put in `criteria` is kept.
  if (!orderBy || !WEBSITE_SORT_FIELDS.includes(orderBy as (typeof WEBSITE_SORT_FIELDS)[number])) {
    return undefined;
  }

  // The id key only breaks ties, so pages never shuffle between requests.
  return [{ [orderBy]: direction }, { id: direction }];
}

export async function getWebsites(
  criteria: Prisma.WebsiteFindManyArgs,
  filters: QueryFilters,
  userId?: string,
): Promise<PageResult<WebsiteListItem[]>> {
  const { getSearchParameters, pagedQuery } = prisma;

  // Sanitise here, once, for every caller. pagedQuery builds its own orderBy from these
  // filters, so an unsanitised orderBy reaches Prisma and throws on any non-column name.
  const sortFilters = sanitizeSortFilters(filters, WEBSITE_SORT_FIELDS);
  const { search } = sortFilters;

  const where: Prisma.WebsiteWhereInput = {
    ...criteria.where,
    ...getSearchParameters(search, [
      {
        name: 'contains',
      },
      { domain: 'contains' },
    ]),
    deletedAt: null,
  };

  const orderBy = getWebsiteOrderBy(sortFilters);

  const websites = userId
    ? await getFavouritesFirstWebsites(criteria, where, sortFilters, userId)
    : await pagedQuery('website', { ...criteria, where, ...(orderBy && { orderBy }) }, sortFilters);

  return attachFavouriteToWebsites(await attachShareIdToWebsites(websites), userId);
}

// Favourites-first ordering is a left join Prisma's findMany cannot express, so the page
// window is read from two ordered segments of the same `where`: the caller's favourites,
// then everything else. Sorting only the current page would break paging.
async function getFavouritesFirstWebsites(
  criteria: Prisma.WebsiteFindManyArgs,
  where: Prisma.WebsiteWhereInput,
  filters: QueryFilters,
  userId: string,
): Promise<PageResult<WebsiteListItem[]>> {
  const { page = 1, pageSize, orderBy, search } = filters;
  const size = +pageSize || DEFAULT_PAGE_SIZE;
  const offset = size > 0 ? size * (+page - 1) : 0;
  const end = size > 0 ? offset + size : Infinity;
  const orderByArgs = getWebsiteOrderBy(filters) ?? [
    { [DEFAULT_WEBSITE_SORT_FIELD]: 'asc' },
    { id: 'asc' },
  ];
  const { website } = prisma.client;

  const favouriteWhere: Prisma.WebsiteWhereInput = {
    AND: [where, { favourites: { some: { userId } } }],
  };
  const otherWhere: Prisma.WebsiteWhereInput = {
    AND: [where, { favourites: { none: { userId } } }],
  };

  const favouriteCount = await website.count({ where: favouriteWhere });
  const favouriteStart = Math.min(offset, favouriteCount);
  const favouriteEnd = Math.min(end, favouriteCount);
  const otherStart = Math.max(0, offset - favouriteCount);
  const otherEnd = end - favouriteCount;

  const otherTake = Number.isFinite(otherEnd) ? Math.max(0, otherEnd - otherStart) : undefined;

  const [favourites, others] = await Promise.all([
    favouriteEnd > favouriteStart
      ? website.findMany({
          ...criteria,
          where: favouriteWhere,
          orderBy: orderByArgs,
          skip: favouriteStart,
          take: favouriteEnd - favouriteStart,
        })
      : [],
    otherTake !== 0
      ? website.findMany({
          ...criteria,
          where: otherWhere,
          orderBy: orderByArgs,
          skip: otherStart,
          ...(otherTake && { take: otherTake }),
        })
      : [],
  ]);

  const count = await website.count({ where });

  return {
    data: [...favourites, ...others] as WebsiteListItem[],
    count,
    page: +page,
    pageSize: size,
    orderBy,
    search,
  };
}

export async function getAllUserWebsitesIncludingTeamAccess(
  userId: string,
  filters?: QueryFilters,
) {
  return getWebsites(
    {
      where: {
        OR: [
          { userId },
          {
            team: {
              deletedAt: null,
              members: {
                some: {
                  role: { in: [ROLES.teamOwner, ROLES.teamManager] },
                  userId,
                },
              },
            },
          },
        ],
      },
    },
    sanitizeSortFilters(filters, WEBSITE_SORT_FIELDS, { orderBy: 'name' }),
    userId,
  );
}

export async function getUserWebsites(userId: string, filters?: QueryFilters) {
  return getWebsites(
    {
      where: {
        userId,
      },
      include: {
        user: {
          select: {
            username: true,
            id: true,
          },
        },
      },
    },
    sanitizeSortFilters(filters, WEBSITE_SORT_FIELDS, { orderBy: 'name' }),
    userId,
  );
}

export async function getTeamWebsites(teamId: string, filters?: QueryFilters) {
  return getWebsites(
    {
      where: {
        teamId,
      },
      include: {
        createUser: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    },
    filters,
  );
}

export async function createWebsite(
  data: Prisma.WebsiteCreateInput | Prisma.WebsiteUncheckedCreateInput,
) {
  return prisma.client.website.create({
    data,
  });
}

export async function updateWebsite(
  websiteId: string,
  data: Prisma.WebsiteUpdateInput | Prisma.WebsiteUncheckedUpdateInput,
) {
  return prisma.client.website.update({
    where: {
      id: websiteId,
    },
    data,
  });
}

export async function resetWebsite(websiteId: string) {
  const { transaction } = prisma;
  const cloudMode = !!process.env.CLOUD_MODE;

  return transaction(
    async tx => {
      await deleteWebsiteDependentData(tx, websiteId);

      const website = await tx.website.update({
        where: { id: websiteId },
        data: {
          resetAt: new Date(),
        },
      });

      return website;
    },
    {
      timeout: 30000,
    },
  ).then(async data => {
    if (cloudMode) {
      await redis.client.set(`website:${websiteId}`, data);
    }

    return data;
  });
}

export async function deleteWebsite(websiteId: string) {
  const { transaction } = prisma;
  const cloudMode = !!process.env.CLOUD_MODE;

  return transaction(
    async tx => {
      await deleteWebsiteDependentData(tx, websiteId);

      await tx.report.deleteMany({
        where: { websiteId },
      });

      await tx.segment.deleteMany({
        where: { websiteId },
      });

      await tx.annotation.deleteMany({
        where: { websiteId },
      });

      await tx.share.deleteMany({
        where: { entityId: websiteId },
      });

      const website = cloudMode
        ? await tx.website.update({
            data: {
              deletedAt: new Date(),
            },
            where: { id: websiteId },
          })
        : await tx.website.delete({
            where: { id: websiteId },
          });

      return website;
    },
    {
      timeout: 30000,
    },
  ).then(async data => {
    if (cloudMode) {
      await redis.client.del(`website:${websiteId}`);
    }

    return data;
  });
}

export async function getWebsiteCount(userId: string) {
  return prisma.client.website.count({
    where: {
      userId,
      deletedAt: null,
    },
  });
}

export async function getTeamWebsiteCount(teamId: string) {
  return prisma.client.website.count({
    where: {
      teamId,
      deletedAt: null,
    },
  });
}

export async function attachShareIdToWebsite(website: Website) {
  const share = await prisma.client.share.findFirst({
    where: {
      entityId: website.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      slug: true,
    },
  });

  return {
    ...website,
    shareId: share?.slug ?? null,
  };
}

async function attachFavouriteToWebsites<
  T extends PageResult<(Website & Partial<WebsiteListItem>)[]>,
>(websites: T, userId?: string): Promise<T> {
  const websiteIds = websites.data.map(website => website.id);
  const favouriteIds = userId ? await getWebsiteFavouriteIds(userId, websiteIds) : [];
  const favourites = new Set(favouriteIds);

  return {
    ...websites,
    data: websites.data.map(website => ({
      ...website,
      favourite: favourites.has(website.id),
    })),
  };
}

export async function attachShareIdToWebsites<
  T extends PageResult<(Website & Partial<WebsiteListItem>)[]>,
>(websites: T): Promise<T> {
  const websiteIds = websites.data.map(website => website.id);

  if (websiteIds.length === 0) {
    return {
      ...websites,
      data: websites.data.map(website => ({ ...website, shareId: null })),
    };
  }

  const shares = await prisma.client.share.findMany({
    where: {
      entityId: { in: websiteIds },
    },
    distinct: ['entityId'],
    orderBy: {
      createdAt: 'desc',
    },
  });

  const shareByWebsiteId = new Map(shares.map(share => [share.entityId, share.slug]));

  return {
    ...websites,
    data: websites.data.map(website => ({
      ...website,
      shareId: shareByWebsiteId.get(website.id) ?? null,
    })),
  };
}
