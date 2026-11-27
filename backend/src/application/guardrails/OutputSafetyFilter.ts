import type { GuardrailContext, OutputGuardrail } from '../../domain/ports';
import type { AgentReply } from '../../domain/types';
import { phrase } from '../messages';
import { containsAny } from './keywords';

const SENSITIVE = ['otp', 'pin', 'password', 'cvv', 'card number', 'upi', 'send money', 'transfer money'];
const NEGATIONS = ['never', 'not', "don't", 'do not', 'mat', 'nahin', 'नहीं', 'मत', 'ಬೇಡ', 'ಹೇಳಬೇಡಿ'];

/**
 * Blocks any model reply that asks the user for credentials or money.
 * Uses the English rendering, which every reply must include.
 */
export class OutputSafetyFilter implements OutputGuardrail {
  readonly name = 'output-safety';

  filter(reply: AgentReply, { venue, language }: GuardrailContext): AgentReply {
    const text = `${reply.replyEnglish} ${reply.reply}`;
    const asksForSecret = containsAny(text, SENSITIVE) && !containsAny(text, NEGATIONS);
    if (!asksForSecret) return reply;

    return {
      lang: language,
      action: 'handoff',
      handoff: { task: 'Unsafe reply blocked', check: 'Assist customer directly', language },
      ...phrase('handoff', language, 'native', { counter: venue.staffCounter }),
    };
  }
}
