import { beforeEach, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { unauthorized } from '@/lib/response';
import { canViewAuthenticatedWebsite } from '@/permissions';
import { favouriteWebsite, getWebsite, unfavouriteWebsite } from '@/queries/prisma';
import { DELETE, POST } from './route';

vi.mock('@/lib/request', () => ({
  parseRequest: vi.fn(),
}));

vi.mock('@/permissions', () => ({
  canViewAuthenticatedWebsite: vi.fn(),
}));

vi.mock('@/queries/prisma', () => ({
  favouriteWebsite: vi.fn(),
  getWebsite: vi.fn(),
  unfavouriteWebsite: vi.fn(),
}));

const parseRequestMock = vi.mocked(parseRequest);
const canViewAuthenticatedWebsiteMock = vi.mocked(canViewAuthenticatedWebsite);
const favouriteWebsiteMock = vi.mocked(favouriteWebsite);
const getWebsiteMock = vi.mocked(getWebsite);
const unfavouriteWebsiteMock = vi.mocked(unfavouriteWebsite);

const url = 'http://localhost/api/websites/website-1/favourite';
const params = Promise.resolve({ websiteId: 'website-1' });

function canStar(body: Record<string, any> = {}) {
  parseRequestMock.mockResolvedValue({
    auth: { user: { id: 'user-1' } },
    body,
    error: undefined,
  } as any);
  getWebsiteMock.mockResolvedValue({ id: 'website-1' } as any);
  canViewAuthenticatedWebsiteMock.mockResolvedValue(true);
}

beforeEach(() => {
  parseRequestMock.mockReset();
  canViewAuthenticatedWebsiteMock.mockReset();
  favouriteWebsiteMock.mockReset();
  getWebsiteMock.mockReset();
  unfavouriteWebsiteMock.mockReset();
});

test('POST stars the website for the signed-in user', async () => {
  // A client-supplied user id must be ignored: the route has no body and always uses auth.user.id.
  canStar({ userId: 'user-2', websiteId: 'website-2' });
  favouriteWebsiteMock.mockResolvedValue({ websiteId: 'website-1' } as any);

  const response = await POST(new Request(url, { method: 'POST' }), { params });

  expect(favouriteWebsiteMock).toHaveBeenCalledWith('website-1', 'user-1');
  expect(favouriteWebsiteMock).not.toHaveBeenCalledWith('website-1', 'user-2');
  expect(await response.json()).toEqual({ ok: true });
  expect(response.status).toBe(200);
});

test('DELETE unstars the website for the signed-in user', async () => {
  canStar();
  unfavouriteWebsiteMock.mockResolvedValue(1);

  const response = await DELETE(new Request(url, { method: 'DELETE' }), { params });

  expect(unfavouriteWebsiteMock).toHaveBeenCalledWith('website-1', 'user-1');
  expect(await response.json()).toEqual({ ok: true });
  expect(response.status).toBe(200);
});

test('POST returns 401 when the caller is not signed in', async () => {
  parseRequestMock.mockResolvedValue({ auth: null, error: () => unauthorized() } as any);

  const response = await POST(new Request(url, { method: 'POST' }), { params });

  expect(response.status).toBe(401);
  expect((await response.json()).error.code).toBe('unauthorized');
  expect(getWebsiteMock).not.toHaveBeenCalled();
  expect(favouriteWebsiteMock).not.toHaveBeenCalled();
});

test('POST returns 401 when the signed-in user cannot view the website', async () => {
  canStar();
  canViewAuthenticatedWebsiteMock.mockResolvedValue(false);

  const response = await POST(new Request(url, { method: 'POST' }), { params });

  expect(response.status).toBe(401);
  expect(favouriteWebsiteMock).not.toHaveBeenCalled();
});

test('POST returns 401 for a website that does not exist', async () => {
  // Permissions say yes (admins pass canViewWebsite without a lookup), so only the
  // getWebsite null check can refuse this; without it the write hits the favourite FK.
  canStar();
  getWebsiteMock.mockResolvedValue(null);

  const response = await POST(new Request(url, { method: 'POST' }), { params });

  expect(response.status).toBe(401);
  expect(favouriteWebsiteMock).not.toHaveBeenCalled();
});

test('starring twice and unstarring a non-favourite both stay successful', async () => {
  canStar();
  favouriteWebsiteMock.mockResolvedValue({ websiteId: 'website-1' } as any);
  // The query layer's deleteMany count is 0 when the row was not favourited.
  unfavouriteWebsiteMock.mockResolvedValue(0);

  const first = await POST(new Request(url, { method: 'POST' }), { params });
  const second = await POST(new Request(url, { method: 'POST' }), { params });
  const unstarred = await DELETE(new Request(url, { method: 'DELETE' }), { params });

  // Only the handler's half: the database no-op (skipDuplicates, count 0) needs Postgres.
  expect([first.status, second.status, unstarred.status]).toEqual([200, 200, 200]);
  expect(favouriteWebsiteMock).toHaveBeenCalledTimes(2);
  expect(unfavouriteWebsiteMock).toHaveBeenCalledTimes(1);
});
