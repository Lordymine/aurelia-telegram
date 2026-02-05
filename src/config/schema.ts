import { z } from 'zod/v4';

export const CONFIG_VERSION = '1.0.0';

const webhookSchema = z.object({
  url: z.string().url(),
  port: z.number().int().min(1).max(65535),
  secretToken: z.string().optional(),
});

const kimiSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
});

const encryptionMetaSchema = z.object({
  salt: z.string(),
  iv: z.string(),
});

export const aureliaConfigSchema = z.object({
  version: z.string(),
  botToken: z.string().min(1, 'botToken is required'),
  allowedUsers: z.array(z.number().int()),
  projectPath: z.string().min(1, 'projectPath is required'),
  deployMode: z.enum(['local', 'vps']),
  webhook: webhookSchema.optional(),
  kimi: kimiSchema,
  encryption: encryptionMetaSchema,
});

export type AureliaConfig = z.infer<typeof aureliaConfigSchema>;

export const DEFAULT_CONFIG: Omit<AureliaConfig, 'botToken' | 'projectPath' | 'encryption'> = {
  version: CONFIG_VERSION,
  allowedUsers: [],
  deployMode: 'local',
  kimi: {},
};

export function validateConfig(data: unknown): AureliaConfig {
  const result = aureliaConfigSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  return result.data;
}
