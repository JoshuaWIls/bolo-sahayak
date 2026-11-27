import Anthropic from '@anthropic-ai/sdk';
import {
  CredentialGuardrail,
  EmergencyGuardrail,
  FraudGuardrail,
} from './application/guardrails/inputGuardrails';
import { OutputSafetyFilter } from './application/guardrails/OutputSafetyFilter';
import { PiiMasker } from './application/guardrails/PiiMasker';
import { IntentHintExtractor } from './application/IntentHintExtractor';
import { ClarificationPolicy } from './application/policies/ClarificationPolicy';
import { LanguagePolicy } from './application/policies/LanguagePolicy';
import { TurnService } from './application/TurnService';
import type { AppConfig } from './config';
import type { LanguageModel, VenueRepository } from './domain/ports';
import { ScriptLanguageDetector } from './infrastructure/language/ScriptLanguageDetector';
import { AnthropicLanguageModel } from './infrastructure/llm/AnthropicLanguageModel';
import { MockLanguageModel } from './infrastructure/llm/MockLanguageModel';
import { PromptBuilder } from './infrastructure/llm/PromptBuilder';
import { InMemorySessionStore } from './infrastructure/session/InMemorySessionStore';
import { JsonVenueRepository } from './infrastructure/venues/JsonVenueRepository';

export interface Container {
  turnService: TurnService;
  venues: VenueRepository;
}

/**
 * Composition root: the only place that knows concrete classes.
 * Swap any adapter here (or via `overrides` in tests) without touching the
 * application layer.
 */
export function buildContainer(
  config: AppConfig,
  overrides: Partial<{ model: LanguageModel; venues: VenueRepository }> = {},
): Container {
  const venues = overrides.venues ?? new JsonVenueRepository(config.venuesDir);
  const model = overrides.model ?? createModel(config);

  const turnService = new TurnService({
    venues,
    model,
    sessions: new InMemorySessionStore(),
    masker: new PiiMasker(),
    detector: new ScriptLanguageDetector(),
    languagePolicy: new LanguagePolicy(2),
    clarificationPolicy: new ClarificationPolicy(0.6, 2),
    intentHints: new IntentHintExtractor(),
    // Order matters: emergencies beat everything else.
    inputGuardrails: [new EmergencyGuardrail(), new CredentialGuardrail(), new FraudGuardrail()],
    outputGuardrails: [new OutputSafetyFilter()],
  });

  return { turnService, venues };
}

function createModel(config: AppConfig): LanguageModel {
  if (config.llmProvider === 'mock') return new MockLanguageModel();
  return new AnthropicLanguageModel(new Anthropic(), new PromptBuilder(), {
    model: config.model,
    effort: 'low',
    maxTokens: 2048,
  });
}
