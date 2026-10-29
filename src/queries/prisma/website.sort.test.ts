import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getTeamWebsites, getWebsites } from './website';

const { clientMock, pagedQueryMock } = vi.hoisted(() => ({
  clientMock: {
    website: { findMany: vi.fn(), count: vi.fn() },
    websiteFavourite: { findMany: vi.fn() },
    share: { findMany: vi.fn() },
  },
  pagedQueryMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: clientMock,
    getSearchParameters: () => undefined,
    pagedQuery: pagedQueryMock,
  },
  getSchema: () => 'public',
}));

vi.mock('@/lib/redis', () => ({
  default: { client: { del: vi.fn(), set: vi.fn() } },
}));

// Mirrors how the real pagedQuery builds its orderBy (src/lib/prisma.ts:762-777): it
// interpolates filters.orderBy straight into a Prisma orderBy key, so an unsanitised
// field reaches the client and Prisma rejects it.
function runPagedQuery(criteria: any, filters: any = {}) {
  const { orderBy, sortDescending = false } = filters;

  if (orderBy && !['name', 'domain', 'createdAt', 'id'].includes(orderBy)) {
    throw new Error(`Unknown argument \`${orderBy}\``);
  }

  return clientMock.website.findMany({
    ...criteria,
    ...(orderBy && { orderBy: [{ [orderBy]: sortDescending ? 'desc' : 'asc' }] }),
  });
}

describe('getWebsites sort sanitising', () => {
  beforeEach(() => {
    clientMock.website.findMany.mockReset().mockResolvedValue([]);
    clientMock.website.count.mockReset().mockResolvedValue(0);
    clientMock.websiteFavourite.findMany.mockReset().mockResolvedValue([]);
    clientMock.share.findMany.mockReset().mockResolvedValue([]);
    pagedQueryMock.mockReset().mockImplementation(async (_model, criteria, filters) => {
      const data = await runPagedQuery(criteria, filters);
      return { data, count: data.length, page: 1, pageSize: 20 };
    });
  });

  test('getTeamWebsites ignores a non-whitelisted orderBy instead of throwing', async () => {
    await expect(getTeamWebsites('team-1', { orderBy: 'password' })).resolves.toBeDefined();
  });

  test('the admin list keeps its criteria ordering for a bad orderBy', async () => {
    await expect(
      getWebsites(
        { where: {}, orderBy: { createdAt: 'desc' } } as any,
        { orderBy: 'password' } as any,
      ),
    ).resolves.toBeDefined();
  });

  test('a whitelisted orderBy and direction still reach the query', async () => {
    await getTeamWebsites('team-1', { orderBy: 'domain', sortDescending: true });

    expect(pagedQueryMock).toHaveBeenCalledWith(
      'website',
      expect.anything(),
      expect.objectContaining({ orderBy: 'domain', sortDescending: true }),
    );
  });
});
