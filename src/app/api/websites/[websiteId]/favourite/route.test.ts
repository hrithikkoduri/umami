import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { canViewAuthenticatedWebsite } from '@/permissions';
import { createWebsiteFavourite, deleteWebsiteFavourite } from '@/queries/prisma';
import { DELETE, POST } from './route';

vi.mock('@/lib/request', () => ({
  parseRequest: vi.fn(),
}));

vi.mock('@/permissions', () => ({
  canViewAuthenticatedWebsite: vi.fn(),
}));

vi.mock('@/queries/prisma', () => ({
  createWebsiteFavourite: vi.fn(),
  deleteWebsiteFavourite: vi.fn(),
}));

const parseRequestMock = vi.mocked(parseRequest);
const canViewAuthenticatedWebsiteMock = vi.mocked(canViewAuthenticatedWebsite);
const createWebsiteFavouriteMock = vi.mocked(createWebsiteFavourite);
const deleteWebsiteFavouriteMock = vi.mocked(deleteWebsiteFavourite);

const websiteId = '0b3e1a8c-6f5c-4c6f-9c0e-3a1f4d2b7e90';
const params = Promise.resolve({ websiteId });
const signedIn = { user: { id: 'user-1', isAdmin: false }, shareToken: undefined };

// In-memory stand-in for the unique (user_id, website_id) constraint.
let favouriteRows: { userId: string; websiteId: string }[];

function star(userId: string, targetWebsiteId: string) {
  if (!favouriteRows.some(row => row.userId === userId && row.websiteId === targetWebsiteId)) {
    favouriteRows.push({ userId, websiteId: targetWebsiteId });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  favouriteRows = [];
  parseRequestMock.mockResolvedValue({ auth: signedIn, error: undefined });
  canViewAuthenticatedWebsiteMock.mockResolvedValue(true);
  createWebsiteFavouriteMock.mockImplementation(async (userId: string, targetWebsiteId: string) => {
    star(userId, targetWebsiteId);
    return undefined as any;
  });
  deleteWebsiteFavouriteMock.mockImplementation(async (userId: string, targetWebsiteId: string) => {
    favouriteRows = favouriteRows.filter(
      row => !(row.userId === userId && row.websiteId === targetWebsiteId),
    );
    return { count: 0 };
  });
});

describe('POST /api/websites/{websiteId}/favourite', () => {
  test('stars the website for the signed-in user', async () => {
    const response = await POST(
      new Request(`http://localhost/api/websites/${websiteId}/favourite`, { method: 'POST' }),
      { params },
    );

    expect(canViewAuthenticatedWebsiteMock).toHaveBeenCalledWith(signedIn, websiteId);
    expect(createWebsiteFavouriteMock).toHaveBeenCalledWith('user-1', websiteId);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ isFavourite: true });
  });

  test('starring twice stays a single row', async () => {
    const request = () =>
      new Request(`http://localhost/api/websites/${websiteId}/favourite`, { method: 'POST' });

    const first = await POST(request(), { params });
    const second = await POST(request(), { params });

    expect(createWebsiteFavouriteMock).toHaveBeenCalledTimes(2);
    expect(favouriteRows).toEqual([{ userId: 'user-1', websiteId }]);
    await expect(first.json()).resolves.toEqual({ isFavourite: true });
    await expect(second.json()).resolves.toEqual({ isFavourite: true });
  });

  test('returns 401 without a session and never writes', async () => {
    parseRequestMock.mockResolvedValue({
      auth: { user: undefined, shareToken: undefined },
      error: undefined,
    });
    canViewAuthenticatedWebsiteMock.mockResolvedValue(false);

    const response = await POST(
      new Request(`http://localhost/api/websites/${websiteId}/favourite`, { method: 'POST' }),
      { params },
    );

    expect(createWebsiteFavouriteMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  test('returns 401 for a share-token request and never writes with an undefined user', async () => {
    parseRequestMock.mockResolvedValue({
      auth: { user: undefined, shareToken: { websiteId } },
      error: undefined,
    });
    canViewAuthenticatedWebsiteMock.mockResolvedValue(false);

    const response = await POST(
      new Request(`http://localhost/api/websites/${websiteId}/favourite`, { method: 'POST' }),
      { params },
    );

    expect(createWebsiteFavouriteMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  test('returns 401 for a website the caller cannot see', async () => {
    canViewAuthenticatedWebsiteMock.mockResolvedValue(false);

    const response = await POST(
      new Request(`http://localhost/api/websites/${websiteId}/favourite`, { method: 'POST' }),
      { params },
    );

    expect(createWebsiteFavouriteMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  test('returns 400 for a non-UUID website id and never reaches the write', async () => {
    const response = await POST(
      new Request('http://localhost/api/websites/not-a-uuid/favourite', { method: 'POST' }),
      { params: Promise.resolve({ websiteId: 'not-a-uuid' }) },
    );

    expect(response.status).toBe(400);
    expect(createWebsiteFavouriteMock).not.toHaveBeenCalled();
    expect(canViewAuthenticatedWebsiteMock).not.toHaveBeenCalled();
  });

  test('returns the parse error before authorising', async () => {
    parseRequestMock.mockResolvedValue({
      auth: signedIn,
      error: () => Response.json({ error: { code: 'bad-request' } }, { status: 400 }),
    });

    const response = await POST(
      new Request(`http://localhost/api/websites/${websiteId}/favourite`, { method: 'POST' }),
      { params },
    );

    expect(response.status).toBe(400);
    expect(createWebsiteFavouriteMock).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/websites/{websiteId}/favourite', () => {
  test('unstars the website and returns ok', async () => {
    favouriteRows = [{ userId: 'user-1', websiteId }];

    const response = await DELETE(
      new Request(`http://localhost/api/websites/${websiteId}/favourite`, { method: 'DELETE' }),
      { params },
    );

    expect(deleteWebsiteFavouriteMock).toHaveBeenCalledWith('user-1', websiteId);
    expect(favouriteRows).toEqual([]);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test('unstarring a website that is not starred is a no-op', async () => {
    const response = await DELETE(
      new Request(`http://localhost/api/websites/${websiteId}/favourite`, { method: 'DELETE' }),
      { params },
    );

    expect(favouriteRows).toEqual([]);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test('returns 400 for a non-UUID website id', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/websites/not-a-uuid/favourite', { method: 'DELETE' }),
      { params: Promise.resolve({ websiteId: 'not-a-uuid' }) },
    );

    expect(response.status).toBe(400);
    expect(deleteWebsiteFavouriteMock).not.toHaveBeenCalled();
  });

  test('returns 401 without a session and never writes', async () => {
    parseRequestMock.mockResolvedValue({
      auth: { user: undefined, shareToken: { websiteId } },
      error: undefined,
    });
    canViewAuthenticatedWebsiteMock.mockResolvedValue(false);

    const response = await DELETE(
      new Request(`http://localhost/api/websites/${websiteId}/favourite`, { method: 'DELETE' }),
      { params },
    );

    expect(deleteWebsiteFavouriteMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });
});
