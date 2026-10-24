import { z } from 'zod';
import { log } from './logger';

const buildSchema = z.object({
  VITE_BUILD: z.enum(['canary', 'prod']).default('prod'),
});

function parseSection<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  source: Record<string, unknown>,
  label: string
): z.infer<z.ZodObject<T>> {
  const result = schema.safeParse(source);
  if (!result.success) {
    log.error(`[env:${label}] Failed to parse environment variables`, { error: result.error });
    return {} as z.infer<z.ZodObject<T>>;
  }
  return result.data;
}

export const env = {
  build: parseSection(buildSchema, import.meta.env as unknown as Record<string, unknown>, 'build'),
};
