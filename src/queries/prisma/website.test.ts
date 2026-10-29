import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  deleteWebsite,
  getAllUserWebsitesIncludingTeamAccess,
  getTeamWebsites,
  getUserWebsites,
  getWebsites,
  resetWebsite,
} from './website';
import { getFavouriteWebsiteIds } from './websiteFavourite';

const {
  transactionMock,
  redisDelMock,
  redisSetMock,
  websiteFindManyMock,
  websiteCountMock,
  shareFindManyMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  redisDelMock: vi.fn(),
  redisSetMock: vi.fn(),
  websiteFindManyMock: vi.fn(),
  websiteCountMock: vi.fn(),
  shareFindManyMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    transaction: transactionMock,
    client: {
      website: {
        findMany: websiteFindManyMock,
        count: websiteCountMock,
      },
      share: {
        findMany: shareFindManyMock,
      },
    },
    getSearchParameters: vi.fn(),
  },
  getSchema: () => new URL(process.env.DATABASE_URL || '').searchParams.get('schema'),
}));

vi.mock('./websiteFavourite', () => ({
  getFavouriteWebsiteIds: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  default: {
    client: {
      del: redisDelMock,
      set: redisSetMock,
    },
  },
}));

function createDeleteTx(calls: string[]) {
  return {
    sessionReplaySaved: {
      deleteMany: vi.fn(async () => {
        calls.push('sessionReplaySaved');
      }),
    },
    sessionReplay: {
      deleteMany: vi.fn(async () => {
        calls.push('sessionReplay');
      }),
    },
    heatmapEvent: {
      deleteMany: vi.fn(async () => {
        calls.push('heatmapEvent');
      }),
    },
    revenue: {
      deleteMany: vi.fn(async () => {
        calls.push('revenue');
      }),
    },
    eventData: {
      deleteMany: vi.fn(async () => {
        calls.push('eventData');
      }),
    },
    $executeRawUnsafe: vi.fn(async () => {
      calls.push('rawSql');
    }),
    sessionData: {
      deleteMany: vi.fn(async () => {
        calls.push('sessionData');
      }),
    },
    sessionLink: {
      deleteMany: vi.fn(async () => {
        calls.push('sessionLink');
      }),
    },
    websiteEvent: {
      deleteMany: vi.fn(async () => {
        calls.push('websiteEvent');
      }),
    },
    session: {
      deleteMany: vi.fn(async () => {
        calls.push('session');
      }),
    },
    report: {
      deleteMany: vi.fn(async () => {
        calls.push('report');
      }),
    },
    segment: {
      deleteMany: vi.fn(async () => {
        calls.push('segment');
      }),
    },
    annotation: {
      deleteMany: vi.fn(async () => {
        calls.push('annotation');
      }),
    },
    share: {
      deleteMany: vi.fn(async () => {
        calls.push('share');
      }),
    },
    website: {
      delete: vi.fn(async () => {
        calls.push('websiteDelete');
        return { id: 'website-1' };
      }),
      update: vi.fn(async () => {
        calls.push('websiteUpdate');
        return { id: 'website-1' };
      }),
    },
  };
}

describe('website delete dependencies', () => {
  beforeEach(() => {
    transactionMock.mockReset();
    redisDelMock.mockReset();
    redisSetMock.mockReset();
    delete process.env.CLOUD_MODE;
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/umami?schema=public';
  });

  test('deleteWebsite runs fast event-data cleanup, a relational safety pass, and heatmap cleanup before deleting website events', async () => {
    const calls: string[] = [];
    const tx = createDeleteTx(calls);

    transactionMock.mockImplementation(async callback => callback(tx));

    await deleteWebsite('website-1');

    expect(tx.eventData.deleteMany).toHaveBeenCalledWith({
      where: { websiteId: 'website-1' },
    });
    expect(tx.heatmapEvent.deleteMany).toHaveBeenCalledWith({
      where: { websiteId: 'website-1' },
    });
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(1, 'SET search_path TO "public";');
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('delete from event_data'),
      'website-1',
    );
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('website_event.website_id = $1'),
      'website-1',
    );
    expect(calls).toEqual([
      'sessionReplaySaved',
      'sessionReplay',
      'heatmapEvent',
      'revenue',
      'eventData',
      'rawSql',
      'rawSql',
      'sessionData',
      'sessionLink',
      'websiteEvent',
      'session',
      'report',
      'segment',
      'annotation',
      'share',
      'websiteDelete',
    ]);
  });

  test('resetWebsite uses the same two-pass event-data cleanup before resetting the website', async () => {
    const calls: string[] = [];
    const tx = createDeleteTx(calls);

    transactionMock.mockImplementation(async callback => callback(tx));

    await resetWebsite('website-1');

    expect(tx.eventData.deleteMany).toHaveBeenCalledWith({
      where: { websiteId: 'website-1' },
    });
    expect(tx.heatmapEvent.deleteMany).toHaveBeenCalledWith({
      where: { websiteId: 'website-1' },
    });
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(1, 'SET search_path TO "public";');
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('website_event.website_id = $1'),
      'website-1',
    );
    expect(calls).toEqual([
      'sessionReplaySaved',
      'sessionReplay',
      'heatmapEvent',
      'revenue',
      'eventData',
      'rawSql',
      'rawSql',
      'sessionData',
      'sessionLink',
      'websiteEvent',
      'session',
      'websiteUpdate',
    ]);
  });
});

type WebsiteRow = { id: string; name: string; domain: string };

// One fake table: findMany filters by the favourites group, sorts and pages like Postgres
// would; count returns the scoped total. This is what makes the emitted arguments testable
// without a database.
function createWebsiteTable(rows: WebsiteRow[], favouriteIds: string[]) {
  const favouriteIdSet = new Set(favouriteIds);

  const inGroup = (row: WebsiteRow, where: any) =>
    (where?.AND ?? []).every((term: any) => {
      const favourites = term.favourites;

      if (!favourites) {
        return true;
      }

      return favourites.some ? favouriteIdSet.has(row.id) : !favouriteIdSet.has(row.id);
    });

  const sortRows = (list: WebsiteRow[], orderBy: any) => {
    const [first] = orderBy ?? [];
    const field = first ? (Object.keys(first)[0] as keyof WebsiteRow) : null;

    if (!field) {
      return list;
    }

    const direction = first[field] === 'desc' ? -1 : 1;

    return [...list].sort((a, b) => a[field].localeCompare(b[field]) * direction);
  };

  websiteFindManyMock.mockImplementation(async (args: any) => {
    const ordered = sortRows(
      rows.filter(row => inGroup(row, args.where)),
      args.orderBy,
    );
    const skip = args.skip ?? 0;

    return ordered.slice(skip, args.take === undefined ? undefined : skip + args.take);
  });

  websiteCountMock.mockImplementation(async (args: any) => {
    return rows.filter(row => inGroup(row, args?.where)).length;
  });

  shareFindManyMock.mockResolvedValue([]);
}

describe('website list favourites-first ordering', () => {
  // domains a..h so the requested orderBy is observable; d and g are favourited.
  const rows: WebsiteRow[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(domain => ({
    id: `website-${domain}`,
    name: `Site ${domain}`,
    domain,
  }));
  const favourites = ['website-d', 'website-g'];
  const baseWhere = { userId: 'user-1', deletedAt: null };
  const favouriteWhere = { AND: [baseWhere, { favourites: { some: { userId: 'user-1' } } }] };
  const restWhere = { AND: [baseWhere, { favourites: { none: { userId: 'user-1' } } }] };
  const ids = (page: { data: WebsiteRow[] }) => page.data.map(website => website.id);

  beforeEach(() => {
    vi.mocked(getFavouriteWebsiteIds).mockReset();
    websiteFindManyMock.mockReset();
    websiteCountMock.mockReset();
    shareFindManyMock.mockReset();
  });

  test('favourites come first and carry isFavourite', async () => {
    createWebsiteTable(rows, favourites);
    vi.mocked(getFavouriteWebsiteIds).mockResolvedValue(favourites);

    const result = await getWebsites({ where: { userId: 'user-1' } }, {}, 'user-1');

    expect(vi.mocked(getFavouriteWebsiteIds)).toHaveBeenCalledWith('user-1');
    expect(ids(result as any)).toEqual([
      'website-d',
      'website-g',
      'website-a',
      'website-b',
      'website-c',
      'website-e',
      'website-f',
      'website-h',
    ]);
    expect(result.data.map(website => website.isFavourite)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(result.count).toBe(8);
  });

  test('the requested orderBy is applied inside each group, not across the whole page', async () => {
    createWebsiteTable(rows, favourites);
    vi.mocked(getFavouriteWebsiteIds).mockResolvedValue(favourites);

    const result = await getWebsites(
      { where: { userId: 'user-1' } },
      { pageSize: 3, orderBy: 'domain', sortDescending: true },
      'user-1',
    );

    expect(websiteFindManyMock).toHaveBeenNthCalledWith(1, {
      where: favouriteWhere,
      orderBy: [{ domain: 'desc' }],
      take: 3,
      skip: 0,
    });
    expect(websiteFindManyMock).toHaveBeenNthCalledWith(2, {
      where: restWhere,
      orderBy: [{ domain: 'desc' }],
      take: 1,
      skip: 0,
    });
    // Descending inside favourites (g, d) then inside the rest (h) — not h, g, d.
    expect(ids(result as any)).toEqual(['website-g', 'website-d', 'website-h']);
  });

  test('a page entirely inside the favourites reads only that group', async () => {
    createWebsiteTable(rows, favourites);
    vi.mocked(getFavouriteWebsiteIds).mockResolvedValue(favourites);

    const result = await getWebsites(
      { where: { userId: 'user-1' } },
      { page: 1, pageSize: 2, orderBy: 'domain' },
      'user-1',
    );

    expect(websiteFindManyMock).toHaveBeenCalledTimes(1);
    expect(websiteFindManyMock).toHaveBeenCalledWith({
      where: favouriteWhere,
      orderBy: [{ domain: 'asc' }],
      take: 2,
      skip: 0,
    });
    expect(ids(result as any)).toEqual(['website-d', 'website-g']);
    expect(result.count).toBe(8);
  });

  test('a page straddling the boundary is topped up from the rest, with no duplicates', async () => {
    createWebsiteTable(rows, favourites);
    vi.mocked(getFavouriteWebsiteIds).mockResolvedValue(favourites);

    const result = await getWebsites(
      { where: { userId: 'user-1' } },
      { page: 1, pageSize: 3, orderBy: 'domain' },
      'user-1',
    );

    expect(websiteFindManyMock).toHaveBeenNthCalledWith(1, {
      where: favouriteWhere,
      orderBy: [{ domain: 'asc' }],
      take: 3,
      skip: 0,
    });
    // Two of the three slots are favourite rows, so one comes from the rest at offset 0.
    expect(websiteFindManyMock).toHaveBeenNthCalledWith(2, {
      where: restWhere,
      orderBy: [{ domain: 'asc' }],
      take: 1,
      skip: 0,
    });
    expect(ids(result as any)).toEqual(['website-d', 'website-g', 'website-a']);
    expect(new Set(ids(result as any)).size).toBe(3);
    expect(result.count).toBe(8);
  });

  test('a page entirely in the rest skips past the favourites', async () => {
    createWebsiteTable(rows, favourites);
    vi.mocked(getFavouriteWebsiteIds).mockResolvedValue(favourites);

    const result = await getWebsites(
      { where: { userId: 'user-1' } },
      { page: 3, pageSize: 2, orderBy: 'domain' },
      'user-1',
    );

    const restCount = await websiteCountMock({ where: restWhere });

    expect(restCount).toBe(6);
    expect(websiteFindManyMock).toHaveBeenCalledTimes(1);
    expect(websiteFindManyMock).toHaveBeenCalledWith({
      where: restWhere,
      orderBy: [{ domain: 'asc' }],
      take: 2,
      skip: 2,
    });
    expect(ids(result as any)).toEqual(['website-c', 'website-e']);
    expect(result.count).toBe(8);
  });

  test('a user with no favourites gets the unchanged plain page', async () => {
    createWebsiteTable(rows, []);
    vi.mocked(getFavouriteWebsiteIds).mockResolvedValue([]);

    const result = await getWebsites(
      { where: { userId: 'user-1' } },
      { page: 1, pageSize: 3, orderBy: 'domain' },
      'user-1',
    );

    expect(websiteFindManyMock).toHaveBeenCalledTimes(1);
    expect(websiteFindManyMock).toHaveBeenCalledWith({
      where: baseWhere,
      orderBy: [{ domain: 'asc' }],
      take: 3,
      skip: 0,
    });
    expect(ids(result as any)).toEqual(['website-a', 'website-b', 'website-c']);
    expect(result.data.every(website => website.isFavourite === false)).toBe(true);
    expect(result.count).toBe(8);
  });

  // The team wrapper's userId is the argument r3 changed; dropping it would leave every team
  // list without favourites-first and every row reporting isFavourite: false.
  test('each list wrapper forwards its requesting user to the favourites lookup', async () => {
    createWebsiteTable(rows, favourites);
    vi.mocked(getFavouriteWebsiteIds).mockResolvedValue(favourites);

    // Cleared before each call so a wrapper that stops forwarding userId cannot be covered
    // by the previous wrapper's call.
    vi.mocked(getFavouriteWebsiteIds).mockClear();
    await getUserWebsites('user-1', {});
    expect(vi.mocked(getFavouriteWebsiteIds)).toHaveBeenCalledWith('user-1');

    vi.mocked(getFavouriteWebsiteIds).mockClear();
    await getAllUserWebsitesIncludingTeamAccess('user-1', {});
    expect(vi.mocked(getFavouriteWebsiteIds)).toHaveBeenCalledWith('user-1');

    vi.mocked(getFavouriteWebsiteIds).mockClear();
    const teamPage = await getTeamWebsites('team-1', 'user-1', {});
    expect(vi.mocked(getFavouriteWebsiteIds)).toHaveBeenCalledWith('user-1');
    expect(teamPage.data.some(website => website.isFavourite)).toBe(true);
  });
});
