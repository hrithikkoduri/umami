import type { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { json, ok, unauthorized } from '@/lib/response';
import { canViewAuthenticatedWebsite } from '@/permissions';
import { createWebsiteFavourite, deleteWebsiteFavourite } from '@/queries/prisma';

// Favourites belong to a signed-in user, so the share token must never reach a write.
async function getAuthorizedContext(
  request: Request,
  params: Promise<{ websiteId: string }>,
  schema?: z.ZodType,
) {
  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return { error: error() };
  }

  const { websiteId } = await params;

  if (!auth?.user || !(await canViewAuthenticatedWebsite(auth, websiteId))) {
    return { error: unauthorized() };
  }

  return { userId: auth.user.id, websiteId, body };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const context = await getAuthorizedContext(request, params);

  if (context.error) {
    return context.error;
  }

  const { userId, websiteId } = context;

  await createWebsiteFavourite(userId, websiteId);

  return json({ isFavourite: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const context = await getAuthorizedContext(request, params);

  if (context.error) {
    return context.error;
  }

  const { userId, websiteId } = context;

  await deleteWebsiteFavourite(userId, websiteId);

  return ok();
}
