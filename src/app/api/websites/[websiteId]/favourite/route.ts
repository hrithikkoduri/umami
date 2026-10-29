import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { badRequest, json, ok, unauthorized } from '@/lib/response';
import { canViewAuthenticatedWebsite } from '@/permissions';
import { createWebsiteFavourite, deleteWebsiteFavourite } from '@/queries/prisma';
import { websiteIdParamsSchema } from './request-schema';

// Favourites belong to a signed-in user, so the share token must never reach a write.
async function getAuthorizedContext(request: Request, params: Promise<{ websiteId: string }>) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return { error: error() };
  }

  const { websiteId } = await params;

  // The path param is not covered by parseRequest, and an invalid UUID reaches the
  // database as a 500, so validate it before any permission check or write.
  const parsed = websiteIdParamsSchema.safeParse({ websiteId });

  if (!parsed.success) {
    return { error: badRequest(z.treeifyError(parsed.error)) };
  }

  if (!auth?.user || !(await canViewAuthenticatedWebsite(auth, parsed.data.websiteId))) {
    return { error: unauthorized() };
  }

  return { userId: auth.user.id, websiteId: parsed.data.websiteId };
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
