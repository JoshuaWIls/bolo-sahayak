import { AgentReplySchema, parseAgentReply } from '../../application/replySchema';
import type { AgentContext, DocumentContext, DocumentReader, LanguageModel } from '../../domain/ports';
import type { PromptBuilder } from './PromptBuilder';

export interface OpenAICompatibleOptions {
  /** e.g. https://generativelanguage.googleapis.com/v1beta/openai */
  baseUrl: string;
  /** Omitted for local servers such as Ollama. */
  apiKey?: string;
  model: string;
  /** Model used for photos; defaults to `model`. */
  visionModel?: string;
  /** Provider-specific request fields (e.g. Gemini's reasoning_effort). */
  extraBody?: Record<string, unknown>;
  timeoutMs?: number;
}

type Content = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: Content };

/** Photos take longer, especially on a local model; the frontend waits 45 s for them. */
const PHOTO_TIMEOUT_MS = 40_000;

/**
 * A filled-in template, not a JSON Schema: small local models copy a schema
 * back verbatim, but reliably follow an example.
 */
const JSON_INSTRUCTIONS = [
  '',
  'OUTPUT FORMAT — answer with exactly one JSON object and nothing else (no markdown), with these 4 keys:',
  '{"lang": "hi", "reply": "<what you say to the user, in the reply language>", "replyEnglish": "<English translation of reply>", "action": "none"}',
  '- lang: "hi", "kn" or "en" — the language of "reply".',
  '- action: one of "none", "camera", "route", "handoff", "fallback", "confirm", "emergency" (see the rules above).',
  '- Only when action is "handoff", also add "handoff": {"task": "...", "check": "...", "language": "hi"} in English.',
  'Do not output a schema or the words above — output your actual answer.',
].join('\n');

/**
 * LanguageModel + DocumentReader over any OpenAI-compatible Chat Completions API:
 * Google Gemini (free key), Groq (free key), Ollama (local), OpenRouter, etc.
 * Uses JSON mode plus the schema in the prompt; TurnService validates the result.
 */
export class OpenAICompatibleModel implements LanguageModel, DocumentReader {
  constructor(
    private readonly prompts: PromptBuilder,
    private readonly options: OpenAICompatibleOptions,
  ) {}

  async generate(ctx: AgentContext): Promise<unknown> {
    const history: ChatMessage[] = ctx.history.map((turn) => ({
      role: turn.role === 'user' ? 'user' : 'assistant',
      content: turn.text,
    }));
    const raw = await this.complete(this.options.model, [
      { role: 'system', content: this.prompts.system(ctx) + JSON_INSTRUCTIONS },
      ...history,
      { role: 'user', content: this.prompts.userMessage(ctx) },
    ]);
    return fillDefaults(raw, ctx.language);
  }

  /** Loads the model into memory so the first real question isn't slow (local Ollama). */
  async warmUp(): Promise<void> {
    await this.complete(this.options.model, [{ role: 'user', content: 'Reply with {"ok":true}' }], 120_000);
  }

  async read(ctx: DocumentContext): Promise<unknown> {
    const raw = await this.complete(this.options.visionModel ?? this.options.model, [
      { role: 'system', content: this.prompts.documentSystem(ctx) + JSON_INSTRUCTIONS },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${ctx.image.mediaType};base64,${ctx.image.base64}` } },
          { type: 'text', text: this.prompts.documentUserMessage(ctx) },
        ],
      },
    ], PHOTO_TIMEOUT_MS);
    return fillDefaults(raw, ctx.language);
  }

  private async complete(model: string, messages: ChatMessage[], timeoutMs = this.options.timeoutMs ?? 15_000): Promise<unknown> {
    const res = await fetch(`${this.options.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
        ...this.options.extraBody,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      // Provider error text explains bad keys / model names / rate limits; it never contains our key.
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`LLM HTTP ${res.status} (${model}): ${detail}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(`LLM returned no content (${model})`);
    return parseJsonLoose(text);
  }
}

/**
 * Small local models often drop the bookkeeping fields. Fill the safe ones so a
 * good reply isn't thrown away: no action → plain answer, no translation → the
 * reply itself. A missing or empty `reply` still fails validation.
 */
export function fillDefaults(raw: unknown, language: string): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  const actions = ['none', 'camera', 'handoff', 'emergency', 'route', 'confirm', 'fallback'];
  return {
    ...o,
    lang: ['hi', 'kn', 'en'].includes(String(o.lang)) ? o.lang : language,
    action: actions.includes(String(o.action)) ? o.action : 'none',
    replyEnglish: typeof o.replyEnglish === 'string' && o.replyEnglish ? o.replyEnglish : o.reply,
  };
}

/** Accepts plain JSON, or JSON wrapped in ``` fences / stray text, as small models sometimes do. */
export function parseJsonLoose(text: string): unknown {
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new Error('LLM reply was not valid JSON');
  }
}

/**
 * Tries the real model first; if it errors (rate limit, network, bad JSON) the
 * keyword-based demo model answers instead, so a free-tier hiccup never leaves
 * someone stuck.
 */
export class FallbackLanguageModel implements LanguageModel {
  constructor(
    private readonly primary: LanguageModel,
    private readonly backup: LanguageModel,
    private readonly log: (msg: string) => void = (m) => console.warn(m),
  ) {}

  async generate(ctx: AgentContext): Promise<unknown> {
    try {
      const out = await this.primary.generate(ctx);
      if (parseAgentReply(out)) return out;
      this.log(`[llm] reply did not match the expected JSON shape (${JSON.stringify(out).slice(0, 200)}) — answering with the demo model instead`);
    } catch (err) {
      this.log(`[llm] ${(err as Error).message} — answering with the demo model instead`);
    }
    return this.backup.generate(ctx);
  }
}
