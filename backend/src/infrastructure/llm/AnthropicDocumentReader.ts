import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AgentReplySchema } from '../../application/replySchema';
import { ModelRefusalError } from '../../domain/errors';
import type { DocumentContext, DocumentReader } from '../../domain/ports';
import type { AnthropicModelOptions } from './AnthropicLanguageModel';
import type { PromptBuilder } from './PromptBuilder';

/** DocumentReader adapter: Claude vision + structured output. */
export class AnthropicDocumentReader implements DocumentReader {
  constructor(
    private readonly client: Anthropic,
    private readonly prompts: PromptBuilder,
    private readonly options: AnthropicModelOptions,
  ) {}

  async read(ctx: DocumentContext): Promise<unknown> {
    const response = await this.client.messages.parse({
      model: this.options.model,
      max_tokens: this.options.maxTokens,
      system: this.prompts.documentSystem(ctx),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: ctx.image.mediaType, data: ctx.image.base64 },
            },
            { type: 'text', text: this.prompts.documentUserMessage(ctx) },
          ],
        },
      ],
      output_config: {
        effort: this.options.effort,
        format: zodOutputFormat(AgentReplySchema),
      },
    });

    if (response.stop_reason === 'refusal') throw new ModelRefusalError();
    return response.parsed_output;
  }
}
