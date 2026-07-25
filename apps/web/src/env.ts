import { z } from 'zod';
const webEnvironmentSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_DEV_AUTH_USER_ID: z.string().uuid().optional(),
  VITE_APP_NAME: z.string().min(1).default('AppSolo Client Hub'),
});
export type WebEnvironment = z.infer<typeof webEnvironmentSchema>;
export function parseWebEnvironment(environment: Record<string, string | undefined>): WebEnvironment {
  return webEnvironmentSchema.parse(environment);
}
export const env = parseWebEnvironment(import.meta.env);
