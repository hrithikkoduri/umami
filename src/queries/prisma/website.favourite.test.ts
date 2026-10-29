import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getAllUserWebsitesIncludingTeamAccess, getUserWebsites } from './website';

interface Row {
  id: string;
  name: string;
  domain: string;
  userId: string;
  teamId: string | null;
}

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    website: { findMany: vi.fn(), count: vi.fn() },
    websiteFavourite: { findMany: vi.fn() },
    share: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: clientMock,
    getSearchParameters: () => undefined,
    pagedQuery: async (_model: string, criteria: any, filters: any = {}) => {
      const { page = 1, pageSize, orderBy, search } = filters;
      const size = +pageSize || 20;
      const data = await clientMock.website.findMany({
        ...criteria,
        ...(size > 0 && { take: size, skip: size * (+page - 1) }),
        ...(criteria.orderBy ? { orderBy: criteria.orderBy } : {}),
      });
      const count = await clientMock.website.count({ where: criteria.where });
      return { data, count, page: +page, pageSize: size, orderBy, search };
    },
  },
  getSchema: () => 'public',
}));

vi.mock('@/lib/redis', () => ({
  default: { client: { del: vi.fn(), set: vi.fn() } },
}));

const rows: Row[] = [
  { id: 'w-delta', name: 'delta', domain: 'delta.dev', userId: 'user-1', teamId: null },
  { id: 'w-alpha', name: 'alpha', domain: 'alpha.dev', userId: 'user-1', teamId: null },
  { id: 'w-charlie', name: 'charlie', domain: 'charlie.dev', userId: 'user-1', teamId: null },
  { id: 'w-bravo', name: 'bravo', domain: 'bravo.dev', userId: 'user-1', teamId: null },
];

let favourites: { userId: string; websiteId: string }[];

function matchesFavourite(row: Row, userId: string) {
  return favourites.some(f => f.userId === userId && f.websiteId === row.id);
}

function isExcluded(where: any, row: Row): boolean {
  const favouriteFilters: any[] = [];

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.favourites) favouriteFilters.push(node.favourites);
    if (Array.isArray(node.AND)) node.AND.forEach(walk);
    if (node.AND && !Array.isArray(node.AND)) walk(node.AND);
  };
  walk(where);

  return favouriteFilters.some(filter => {
    if (filter.some) return !matchesFavourite(row, filter.some.userId);
    if (filter.none) return matchesFavourite(row, filter.none.userId);
    return false;
  });
}

function applyOrder(items: Row[], orderBy: any[]) {
  return [...items].sort((a, b) => {
    for (const entry of orderBy) {
      const [[field, direction]] = Object.entries(entry) as [keyof Row, string][];
      const left = String(a[field] ?? '');
      const right = String(b[field] ?? '');
      if (left !== right) return (left < right ? -1 : 1) * (direction === 'desc' ? -1 : 1);
    }
    return 0;
  });
}

describe('website favourites ordering', () => {
  beforeEach(() => {
    for (const model of Object.values(clientMock)) {
      for (const fn of Object.values(model) as ReturnType<typeof vi.fn>[]) {
        fn.mockReset();
      }
    }

    favourites = [];

    clientMock.website.findMany.mockImplementation(
      async ({ where, orderBy, skip = 0, take }: any) => {
        const filtered = applyOrder(
          rows.filter(row => !isExcluded(where, row)),
          orderBy,
        );
        return take === undefined ? filtered.slice(skip) : filtered.slice(skip, skip + take);
      },
    );

    clientMock.website.count.mockImplementation(async ({ where }: any) => {
      return rows.filter(row => !isExcluded(where, row)).length;
    });

    clientMock.websiteFavourite.findMany.mockImplementation(async ({ where }: any) => {
      return favourites
        .filter(f => f.userId === where.userId && where.websiteId.in.includes(f.websiteId))
        .map(f => ({ websiteId: f.websiteId }));
    });

    clientMock.share.findMany.mockImplementation(async () => []);
  });

  test('favourited rows come first for every sort field and direction', async () => {
    favourites = [{ userId: 'user-1', websiteId: 'w-delta' }];

    for (const orderBy of ['name', 'domain', 'createdAt']) {
      for (const sortDescending of [false, true]) {
        const result = await getUserWebsites('user-1', { orderBy, sortDescending });
        const ids = result.data.map(website => website.id);

        expect(ids[0]).toBe('w-delta');
        expect(ids).toHaveLength(rows.length);
        expect(new Set(ids).size).toBe(rows.length);
      }
    }
  });

  test('keeps the requested sort order among the unstarred rows', async () => {
    const ascending = await getUserWebsites('user-1', { orderBy: 'name' });
    const descending = await getUserWebsites('user-1', { orderBy: 'name', sortDescending: true });

    expect(ascending.data.map(website => website.name)).toEqual([
      'alpha',
      'bravo',
      'charlie',
      'delta',
    ]);
    expect(descending.data.map(website => website.name)).toEqual([
      'delta',
      'charlie',
      'bravo',
      'alpha',
    ]);
  });

  test('an unknown sort field falls back to the whitelisted default', async () => {
    const result = await getUserWebsites('user-1', { orderBy: 'password' });
    const orderBy = clientMock.website.findMany.mock.calls[0][0].orderBy;

    expect(orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }]);
    expect(result.data.map(website => website.name)).toEqual([
      'alpha',
      'bravo',
      'charlie',
      'delta',
    ]);
  });

  test('the id tiebreaker keeps rows with equal sort values stable across pages', async () => {
    rows.forEach(row => {
      row.name = 'same';
    });

    const firstPage = await getUserWebsites('user-1', { orderBy: 'name', page: 1, pageSize: 2 });
    const secondPage = await getUserWebsites('user-1', { orderBy: 'name', page: 2, pageSize: 2 });
    const ids = [...firstPage.data, ...secondPage.data].map(website => website.id);

    expect(ids).toEqual([...rows.map(row => row.id)].sort());
    expect(new Set(ids).size).toBe(rows.length);
  });

  test('paging keeps favourites first across the page boundary', async () => {
    favourites = [
      { userId: 'user-1', websiteId: 'w-delta' },
      { userId: 'user-1', websiteId: 'w-charlie' },
    ];

    const firstPage = await getUserWebsites('user-1', { orderBy: 'name', page: 1, pageSize: 1 });
    const secondPage = await getUserWebsites('user-1', { orderBy: 'name', page: 2, pageSize: 1 });
    const thirdPage = await getUserWebsites('user-1', { orderBy: 'name', page: 3, pageSize: 1 });

    expect(firstPage.data.map(website => website.id)).toEqual(['w-charlie']);
    expect(secondPage.data.map(website => website.id)).toEqual(['w-delta']);
    expect(thirdPage.data.map(website => website.id)).toEqual(['w-alpha']);
    expect(firstPage.count).toBe(4);
    expect(firstPage.pageSize).toBe(1);
  });

  test('the favourite flag is only true for the calling user rows', async () => {
    favourites = [
      { userId: 'user-1', websiteId: 'w-alpha' },
      { userId: 'user-2', websiteId: 'w-bravo' },
    ];

    const firstUser = await getUserWebsites('user-1', { orderBy: 'name' });
    const secondUser = await getUserWebsites('user-2', { orderBy: 'name' });

    expect(firstUser.data.find(website => website.id === 'w-alpha').favourite).toBe(true);
    expect(firstUser.data.find(website => website.id === 'w-bravo').favourite).toBe(false);
    expect(secondUser.data.find(website => website.id === 'w-bravo').favourite).toBe(true);
    expect(secondUser.data.find(website => website.id === 'w-alpha').favourite).toBe(false);
  });

  test('team access uses the same favourites-first ordering', async () => {
    rows.push({
      id: 'w-echo',
      name: 'echo',
      domain: 'echo.dev',
      userId: 'user-2',
      teamId: 'team-1',
    });
    favourites = [
      { userId: 'user-1', websiteId: 'w-echo' },
      { userId: 'user-1', websiteId: 'w-alpha' },
    ];

    const result = await getAllUserWebsitesIncludingTeamAccess('user-1', { orderBy: 'name' });
    const ids = result.data.map(website => website.id);

    expect(ids.slice(0, 2).sort()).toEqual(['w-alpha', 'w-echo']);
    expect(ids).toHaveLength(5);
  });
});
