import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

type ApiEnvironmentPaths = {
  root: string;
  api: string;
};
const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const defaultEnvironmentPaths: ApiEnvironmentPaths = {
  root: resolve(sourceDirectory, '../../../../.env'),
  api: resolve(sourceDirectory, '../../.env'),
};

export function loadApiEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  paths: ApiEnvironmentPaths = defaultEnvironmentPaths,
): NodeJS.ProcessEnv {
  for (const path of [paths.root, paths.api]) {
    const fileValues: Record<string, string> = {};
    loadEnv({ path, processEnv: fileValues, quiet: true });
    for (const [key, value] of Object.entries(fileValues)) {
      if (environment[key] === undefined) environment[key] = value;
    }
  }
  return environment;
}

loadApiEnvironment();

const localDatabaseUrl = (env: NodeJS.ProcessEnv): string | undefined => {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, APPSOLO_DB_NAME } = env;
  const databaseName = APPSOLO_DB_NAME ?? DB_NAME;
  return DB_HOST && DB_PORT && databaseName && DB_USER && DB_PASSWORD
    ? `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${databaseName}`
    : undefined;
};
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z
    .string()
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.array(z.string().url()).min(1)),
  DEV_AUTH_ENABLED: z.enum(['true', 'false']).transform((value) => value === 'true'),
  DEV_AUTH_USER_ID: z.string().uuid().optional(),
  APPSOLO_USE_TEST_DATABASE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  REQUEST_BODY_LIMIT: z.string().default('1mb'),
});
export type ApiConfig = z.infer<typeof envSchema>;
export function parseApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const result = envSchema.safeParse({ ...environment, DATABASE_URL: localDatabaseUrl(environment) });
  if (!result.success)
    throw new Error(
      `Invalid API configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  if (result.data.NODE_ENV === 'production' && result.data.DEV_AUTH_ENABLED)
    throw new Error('Invalid API configuration: development authentication is prohibited in production.');
  return result.data;
}
