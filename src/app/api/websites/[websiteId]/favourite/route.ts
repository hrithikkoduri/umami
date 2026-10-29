import { parseRequest } from '@/lib/request';
import { ok, unauthorized } from '@/lib/response';
import { canViewAuthenticatedWebsite } from '@/permissions';
import { favouriteWebsite, getWebsite, unfavouriteWebsite } from '@/queries/prisma';

async function authorize(request: Request, params: Promise<{ websiteId: string }>) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return { response: error() };
  }

  const { websiteId } = await params;
  const website = await getWebsite(websiteId);

  // A malformed, missing or unviewable id all answer 401, like the rest of the website routes:
  // this codebase has no 403 split. The null check is not redundant — canViewWebsite passes
  // admins through without looking the website up, and the favourite row has a foreign key.
  if (!website || !(await canViewAuthenticatedWebsite(auth, websiteId))) {
    return { response: unauthorized() };
  }

  return { userId: auth.user.id, websiteId };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const result = await authorize(request, params);

  if ('response' in result) {
    return result.response;
  }

  await favouriteWebsite(result.websiteId, result.userId);

  return ok();
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const result = await authorize(request, params);

  if ('response' in result) {
    return result.response;
  }

  await unfavouriteWebsite(result.websiteId, result.userId);

  return ok();
}
