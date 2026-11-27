import path from 'node:path';

/**
 * "mock"      — offline keyword demo, no key.
 * "anthropic" — Claude API (ANTHROPIC_API_KEY).
 * "gemini"    — Google Gemini free key from aistudio.google.com (GEMINI_API_KEY).
 * "groq"      — Groq free key from console.groq.com (GROQ_API_KEY).
 * "ollama"    — local models via Ollama, no key.
 * "openai"    — any other OpenAI-compatible API (LLM_BASE_URL + LLM_API_KEY).
 */
export const PROVIDERS = ['mock', 'anthropic', 'gemini', 'groq', 'ollama', 'openai'] as const;
export type LlmProvider = (typeof PROVIDERS)[number];

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey?: string;
  /** Env var the key comes from — named in error messages, never the key itself. */
  apiKeyEnv?: string;
  visionModel?: string;
  extraBody?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface AppConfig {
  port: number;
  llmProvider: LlmProvider;
  model: string;
  /** Set for gemini / groq / ollama / openai. */
  openai?: OpenAICompatibleConfig;
  venuesDir: string;
  corsOrigin: string | string[];
}

type Preset = {
  baseUrl: string;
  keyEnv?: string;
  model: string;
  visionModel?: string;
  extraBody?: Record<string, unknown>;
  timeoutMs?: number;
};

/** Defaults per provider. Model names change often — `npm run models` lists what your key can use. */
const PRESETS: Record<Exclude<LlmProvider, 'mock' | 'anthropic'>, Preset> = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    // Google's rolling alias for the current Flash model (handles photos too).
    model: 'gemini-flash-latest',
    // Keep "thinking" short so voice replies stay fast.
    extraBody: { reasoning_effort: 'low' },
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile',
    visionModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
  // gemma3:4b (~3.4 GB) fits an 8 GB Mac, speaks Hindi/Kannada and reads photos.
  // 15 s leaves room inside the frontend's 25 s wait for the demo model to answer
  // instead if the model is still loading (8 GB Macs can take 20 s+ to reload it).
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'gemma3:4b', timeoutMs: 15_000 },
  openai: { baseUrl: '', keyEnv: 'LLM_API_KEY', model: '' },
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const provider = (env.LLM_PROVIDER ?? 'mock').toLowerCase() as LlmProvider;
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`LLM_PROVIDER must be one of ${PROVIDERS.join(', ')} — got "${provider}"`);
  }

  const base = {
    port: Number(env.PORT ?? 4000),
    llmProvider: provider,
    venuesDir: env.VENUES_DIR ?? path.resolve(process.cwd(), 'data/venues'),
    corsOrigin: env.CORS_ORIGIN?.split(',') ?? 'http://localhost:5173',
  };

  if (provider === 'mock' || provider === 'anthropic') {
    return { ...base, model: env.LLM_MODEL || 'claude-opus-5-5' };
  }

  const preset = PRESETS[provider];
  const keyEnv = preset.keyEnv;
  return {
    ...base,
    model: env.LLM_MODEL || preset.model,
    openai: {
      baseUrl: env.LLM_BASE_URL || preset.baseUrl,
      apiKey: (keyEnv && env[keyEnv]) || env.LLM_API_KEY || undefined,
      apiKeyEnv: keyEnv,
      visionModel: env.LLM_VISION_MODEL || preset.visionModel,
      extraBody: preset.extraBody,
      timeoutMs: preset.timeoutMs,
    },
  };
}

/** A human-readable reason the config can't run, or null if it's fine. */
export function configProblem(config: AppConfig, env: NodeJS.ProcessEnv = process.env): string | null {
  if (config.llmProvider === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    return 'LLM_PROVIDER=anthropic needs ANTHROPIC_API_KEY.';
  }
  const o = config.openai;
  if (!o) return null;
  if (!o.baseUrl) return `LLM_PROVIDER=${config.llmProvider} needs LLM_BASE_URL.`;
  if (!config.model) return `LLM_PROVIDER=${config.llmProvider} needs LLM_MODEL.`;
  if (config.llmProvider !== 'ollama' && !o.apiKey) {
    return `LLM_PROVIDER=${config.llmProvider} needs ${o.apiKeyEnv ?? 'LLM_API_KEY'} in backend/.env.`;
  }
  return null;
}
