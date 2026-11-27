import Anthropic from '@anthropic-ai/sdk';
import { DocumentService } from './application/DocumentService';
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
import { LanguageRequestDetector } from './application/policies/LanguageRequestDetector';
import { VenueScopePolicy } from './application/policies/VenueScopePolicy';
import { TurnService } from './application/TurnService';
import type { AppConfig } from './config';
import type { DocumentReader, LanguageModel, SessionStore, VenueRepository } from './domain/ports';
import { ScriptLanguageDetector } from './infrastructure/language/ScriptLanguageDetector';
import { AnthropicDocumentReader } from './infrastructure/llm/AnthropicDocumentReader';
import { AnthropicLanguageModel, type AnthropicModelOptions } from './infrastructure/llm/AnthropicLanguageModel';
import { MockDocumentReader } from './infrastructure/llm/MockDocumentReader';
import { MockLanguageModel } from './infrastructure/llm/MockLanguageModel';
import { FallbackLanguageModel, OpenAICompatibleModel } from './infrastructure/llm/OpenAICompatibleModel';
import { PromptBuilder } from './infrastructure/llm/PromptBuilder';
import { InMemorySessionStore } from './infrastructure/session/InMemorySessionStore';
import { JsonVenueRepository } from './infrastructure/venues/JsonVenueRepository';

export interface Container {
  turnService: TurnService;
  documentService: DocumentService;
  venues: VenueRepository;
  /** Preloads a local model (Ollama), if any. Safe to call often: throttled, never throws. */
  warmUp?: () => Promise<void>;
}

/**
 * Composition root: the only place that knows concrete classes.
 * Swap any adapter here (or via `overrides` in tests) without touching the
 * application layer.
 */
export function buildContainer(
  config: AppConfig,
  overrides: Partial<{
    model: LanguageModel;
    reader: DocumentReader;
    venues: VenueRepository;
    sessions: SessionStore;
  }> = {},
): Container {
  const venues = overrides.venues ?? new JsonVenueRepository(config.venuesDir);
  const sessions = overrides.sessions ?? new InMemorySessionStore();
  const masker = new PiiMasker();
  const outputGuardrails = [new OutputSafetyFilter()];
  const anthropic = config.llmProvider === 'anthropic' ? createAnthropic(config) : null;
  const compatible = config.openai
    ? new OpenAICompatibleModel(new PromptBuilder(), { ...config.openai, model: config.model })
    : null;

  const turnService = new TurnService({
    venues,
    model: overrides.model ?? defaultModel(anthropic, compatible),
    sessions,
    masker,
    detector: new ScriptLanguageDetector(),
    languagePolicy: new LanguagePolicy(2),
    languageRequests: new LanguageRequestDetector(),
    clarificationPolicy: new ClarificationPolicy(0.6, 2),
    scopePolicy: new VenueScopePolicy(),
    intentHints: new IntentHintExtractor(),
    // Order matters: emergencies beat everything else.
    inputGuardrails: [new EmergencyGuardrail(), new CredentialGuardrail(), new FraudGuardrail()],
    outputGuardrails,
  });

  const documentService = new DocumentService({
    venues,
    sessions,
    masker,
    reader:
      overrides.reader ??
      (anthropic
        ? new AnthropicDocumentReader(anthropic.client, anthropic.prompts, anthropic.options)
        : (compatible ?? new MockDocumentReader())),
    outputGuardrails,
  });

  const warmUp = compatible && config.llmProvider === 'ollama' ? throttled(() => compatible.warmUp(), 60_000) : undefined;
  return { turnService, documentService, venues, warmUp };
}

function defaultModel(
  anthropic: ReturnType<typeof createAnthropic> | null,
  compatible: OpenAICompatibleModel | null,
): LanguageModel {
  if (anthropic) return new AnthropicLanguageModel(anthropic.client, anthropic.prompts, anthropic.options);
  // Free tiers rate-limit; fall back to the keyword demo rather than failing the turn.
  if (compatible) return new FallbackLanguageModel(compatible, new MockLanguageModel());
  return new MockLanguageModel();
}

function createAnthropic(config: AppConfig) {
  const options: AnthropicModelOptions = { model: config.model, effort: 'low', maxTokens: 2048 };
  return { client: new Anthropic(), prompts: new PromptBuilder(), options };
}

/**
 * Runs `fn` at most once per `everyMs`; overlapping callers share the running call.
 * The first call's error is passed on (startup logs it); later failures are swallowed.
 */
function throttled(fn: () => Promise<void>, everyMs: number): () => Promise<void> {
  let last = 0;
  let running: Promise<void> | null = null;
  let first = true;
  return () => {
    if (running) return running;
    if (Date.now() - last < everyMs) return Promise.resolve();
    last = Date.now();
    const call = fn().finally(() => {
      running = null;
    });
    running = first ? call : call.catch(() => undefined);
    first = false;
    return running;
  };
}
