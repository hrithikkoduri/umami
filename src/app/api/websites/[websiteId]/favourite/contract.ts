import { defineOperation } from '@/openapi/operation';
import { jsonResponse, okSchema, unauthorizedResponse } from '@/openapi/schemas';
import { websiteIdPathSchema } from '../../response-schema';

const favouriteWebsiteOperation = defineOperation({
  method: 'post',
  path: '/api/websites/{websiteId}/favourite',
  audience: 'public',
  auth: 'bearer',
  operation: {
    operationId: 'favouriteWebsite',
    summary: 'Favourite a website',
    tags: ['Websites'],
    requestParams: {
      path: websiteIdPathSchema,
    },
    responses: {
      '200': jsonResponse(okSchema, 'The website is favourited for the current user.'),
      '401': unauthorizedResponse,
    },
  },
});

const unfavouriteWebsiteOperation = defineOperation({
  method: 'delete',
  path: '/api/websites/{websiteId}/favourite',
  audience: 'public',
  auth: 'bearer',
  operation: {
    operationId: 'unfavouriteWebsite',
    summary: 'Unfavourite a website',
    tags: ['Websites'],
    requestParams: {
      path: websiteIdPathSchema,
    },
    responses: {
      '200': jsonResponse(okSchema, 'The website is no longer favourited for the current user.'),
      '401': unauthorizedResponse,
    },
  },
});

export const operations = [favouriteWebsiteOperation, unfavouriteWebsiteOperation] as const;
