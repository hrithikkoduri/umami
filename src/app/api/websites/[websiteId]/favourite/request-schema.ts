import { z } from 'zod';

export const websiteIdParamsSchema = z.object({ websiteId: z.uuid() });
