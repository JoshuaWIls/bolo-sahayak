import { z } from 'zod';
import type { AgentReply } from '../domain/types';

/** The contract every LanguageModel output must satisfy. */
export const AgentReplySchema = z.object({
  lang: z.enum(['hi', 'kn', 'en']),
  reply: z.string(),
  replyEnglish: z.string(),
  action: z.enum(['none', 'camera', 'handoff', 'emergency', 'route', 'confirm', 'fallback']),
  handoff: z
    .object({ task: z.string(), check: z.string(), language: z.string() })
    .optional(),
});

export function parseAgentReply(raw: unknown): AgentReply | null {
  const value = typeof raw === 'string' ? safeJson(raw) : raw;
  const result = AgentReplySchema.safeParse(value);
  if (!result.success) return null;
  if (result.data.reply.trim().length === 0) return null;
  return result.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
