import type { GuardrailContext, OutputGuardrail } from '../../domain/ports';
import type { AgentReply } from '../../domain/types';
import { phrase } from '../messages';
import { containsAny } from './keywords';

const SENSITIVE = ['otp', 'pin', 'password', 'cvv', 'card number', 'upi', 'send money', 'transfer money'];
const NEGATIONS = ['never', 'not', "don't", 'do not', 'mat', 'nahin', 'नहीं', 'मत', 'ಬೇಡ', 'ಹೇಳಬೇಡಿ'];

/**
 * Blocks any model reply that asks the user for credentials or money.
 * Checks every sentence on its own (English rendering + native reply), so a
 * harmless "don't worry" in one sentence can't excuse "tell me your OTP" in
 * the next.
 */
export class OutputSafetyFilter implements OutputGuardrail {
  readonly name = 'output-safety';

  filter(reply: AgentReply, { venue, language, script }: GuardrailContext): AgentReply {
    const sentences = `${reply.replyEnglish}\n${reply.reply}`.split(/[.!?।\n]+/);
    const asksForSecret = sentences.some((s) => containsAny(s, SENSITIVE) && !containsAny(s, NEGATIONS));
    if (!asksForSecret) return reply;

    return {
      lang: language,
      action: 'handoff',
      handoff: { task: 'Unsafe reply blocked', check: 'Assist customer directly', language },
      ...phrase('handoff', language, script, { counter: venue.staffCounter }),
    };
  }
}
