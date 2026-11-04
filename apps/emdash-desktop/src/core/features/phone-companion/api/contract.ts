import { defineContract, procedure } from '@emdash/wire/rpc';
import { z } from 'zod';

export const phoneCompanionDomain = 'phoneCompanion' as const;

const stateSchema = z.object({
  enabled: z.boolean(),
  running: z.boolean(),
  url: z.string().optional(),
  qrSvg: z.string().optional(),
  error: z.string().optional(),
});

export const phoneCompanionContract = defineContract({
  state: procedure({ input: z.void().optional(), output: stateSchema }),
  setEnabled: procedure({ input: z.object({ enabled: z.boolean() }), output: stateSchema }),
  rotateToken: procedure({ input: z.void().optional(), output: stateSchema }),
});
