import { z } from 'zod/v4';

// TODO: Define full schema in Story 1.2
export const aureliaConfigSchema = z.object({
  botToken: z.string(),
  allowedUsers: z.array(z.number()),
});

export type AureliaConfig = z.infer<typeof aureliaConfigSchema>;
