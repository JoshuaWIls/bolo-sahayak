import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AgentReplySchema } from '../../application/replySchema';
import { ModelRefusalError } from '../../domain/errors';
import type { AgentContext, LanguageModel } from '../../domain/ports';
import type { PromptBuilder } from './PromptBuilder';

export interface AnthropicModelOptions {
  model: string;
  /** Low effort keeps voice latency down; raise only if quality needs it. */
  effort: 'low' | 'medium' | 'high';
  maxTokens: number;
}

/** LanguageModel adapter for the Claude Messages API using structured outputs. */
export class AnthropicLanguageModel implements LanguageModel {
  constructor(
    private readonly client: Anthropic,
    private readonly prompts: PromptBuilder,
    private readonly options: AnthropicModelOptions,
  ) {}

  async generate(ctx: AgentContext): Promise<unknown> {
    const history: Anthropic.MessageParam[] = ctx.history.map((turn) => ({
      role: turn.role === 'user' ? 'user' : 'assistant',
      content: turn.text,
    }));

    const response = await this.client.messages.parse({
      model: this.options.model,
      max_tokens: this.options.maxTokens,
      system: this.prompts.system(ctx),
      messages: [...history, { role: 'user', content: this.prompts.userMessage(ctx) }],
      output_config: {
        effort: this.options.effort,
        format: zodOutputFormat(AgentReplySchema),
      },
    });

    if (response.stop_reason === 'refusal') throw new ModelRefusalError();
    return response.parsed_output;
  }
}
