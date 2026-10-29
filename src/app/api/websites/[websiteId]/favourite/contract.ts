import { z } from 'zod';
import { defineOperation } from '@/openapi/operation';
import { jsonResponse, okSchema, unauthorizedResponse } from '@/openapi/schemas';

const websiteIdPathSchema = z.object({ websiteId: z.uuid() });

const isFavouriteSchema = z
  .object({ isFavourite: z.literal(true) })
  .meta({ id: 'WebsiteFavouriteStatus', description: 'Whether the website is starred.' });

export const operations = [
  defineOperation({
    method: 'post',
    path: '/api/websites/{websiteId}/favourite',
    audience: 'public',
    auth: 'bearer',
    operation: {
      operationId: 'createWebsiteFavourite',
      summary: 'Star a website',
      description:
        'Stars the website for the signed-in user. Starring an already starred website keeps a single row and returns the same response.',
      tags: ['Websites'],
      requestParams: { path: websiteIdPathSchema },
      responses: {
        '200': jsonResponse(isFavouriteSchema, 'Website starred.'),
        '401': unauthorizedResponse,
      },
    },
  }),
  defineOperation({
    method: 'delete',
    path: '/api/websites/{websiteId}/favourite',
    audience: 'public',
    auth: 'bearer',
    operation: {
      operationId: 'deleteWebsiteFavourite',
      summary: 'Unstar a website',
      description:
        'Removes the signed-in user’s star from the website. Unstarring a website that is not starred is a no-op.',
      tags: ['Websites'],
      requestParams: { path: websiteIdPathSchema },
      responses: {
        '200': jsonResponse(okSchema, 'Website unstarred.'),
        '401': unauthorizedResponse,
      },
    },
  }),
] as const;
