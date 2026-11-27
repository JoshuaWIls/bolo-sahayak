import path from 'node:path';

export interface AppConfig {
  port: number;
  /** "mock" runs fully offline; "anthropic" calls the Claude API. */
  llmProvider: 'mock' | 'anthropic';
  model: string;
  venuesDir: string;
  corsOrigin: string | string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const provider = (env.LLM_PROVIDER ?? 'mock').toLowerCase();
  if (provider !== 'mock' && provider !== 'anthropic') {
    throw new Error(`LLM_PROVIDER must be "mock" or "anthropic", got "${provider}"`);
  }
  return {
    port: Number(env.PORT ?? 4000),
    llmProvider: provider,
    model: env.LLM_MODEL ?? 'claude-opus-5-5',
    venuesDir: env.VENUES_DIR ?? path.resolve(process.cwd(), 'data/venues'),
    corsOrigin: env.CORS_ORIGIN?.split(',') ?? 'http://localhost:5173',
  };
}
