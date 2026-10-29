import { beforeEach, describe, expect, test, vi } from 'vitest';
import { deleteUser, getUserByUsername } from './user';

const { clientMock, transactionMock } = vi.hoisted(() => ({
  clientMock: {
    website: { findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    team: { findMany: vi.fn(), deleteMany: vi.fn() },
    link: { findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    pixel: { findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    board: { findMany: vi.fn(), deleteMany: vi.fn() },
    eventData: { deleteMany: vi.fn() },
    sessionData: { deleteMany: vi.fn() },
    websiteEvent: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    websiteFavourite: { deleteMany: vi.fn() },
    teamUser: { deleteMany: vi.fn() },
    report: { deleteMany: vi.fn() },
    share: { deleteMany: vi.fn() },
    user: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
  },
  transactionMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    client: clientMock,
    transaction: transactionMock,
  },
}));

vi.mock('@/lib/redis', () => ({
  default: {
    enabled: false,
    client: { del: vi.fn() },
  },
}));

const { user: userClient, website: websiteClient, team: teamClient } = clientMock;

function resetClient() {
  for (const model of Object.values(clientMock)) {
    for (const fn of Object.values(model) as ReturnType<typeof vi.fn>[]) {
      fn.mockReset();
    }
  }

  websiteClient.findMany.mockResolvedValue([{ id: 'website-1' }]);
  teamClient.findMany.mockResolvedValue([]);
  clientMock.link.findMany.mockResolvedValue([]);
  clientMock.pixel.findMany.mockResolvedValue([]);
  clientMock.board.findMany.mockResolvedValue([]);
}

describe('getUserByUsername', () => {
  beforeEach(() => {
    resetClient();
    userClient.findUnique.mockResolvedValue(null);
  });

  test('normalizes usernames to lowercase before lookup', async () => {
    await getUserByUsername('KaKi87', { includePassword: true });

    expect(userClient.findUnique).toHaveBeenCalledWith({
      where: {
        username: 'kaki87',
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        password: true,
        role: true,
        createdAt: true,
        twoFactorRequired: true,
      },
    });
  });

  test('can include deleted users while still lowercasing the username', async () => {
    await getUserByUsername('KaKi87', { showDeleted: true });

    expect(userClient.findUnique).toHaveBeenCalledWith({
      where: {
        username: 'kaki87',
      },
      select: {
        id: true,
        username: true,
        password: false,
        role: true,
        createdAt: true,
        twoFactorRequired: true,
      },
    });
  });
});

describe('deleteUser', () => {
  beforeEach(() => {
    resetClient();
    delete process.env.CLOUD_MODE;
    transactionMock.mockReset();
    transactionMock.mockImplementation(async operations => operations);
  });

  test('hard delete purges the favourites of the user and of their websites', async () => {
    await deleteUser('user-1');

    expect(clientMock.websiteFavourite.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: 'user-1' }, { websiteId: { in: ['website-1'] } }] },
    });
    expect(clientMock.websiteFavourite.deleteMany).toHaveBeenCalledBefore(userClient.delete);
  });

  test('soft delete in cloud mode keeps the favourites', async () => {
    process.env.CLOUD_MODE = '1';

    await deleteUser('user-1');

    expect(clientMock.websiteFavourite.deleteMany).not.toHaveBeenCalled();
  });
});
