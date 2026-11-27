import { createContext, useContext, type ReactNode } from 'react';
import { HttpAssistantApi } from '../infrastructure/HttpAssistantApi';
import { WebSpeechRecognizer, WebSpeechSynthesizer } from '../infrastructure/WebSpeech';
import type { AssistantApi, SpeechRecognizer, SpeechSynthesizer } from '../ports';

export interface Services {
  api: AssistantApi;
  recognizer: SpeechRecognizer;
  synthesizer: SpeechSynthesizer;
}

/** Composition root for the browser. Tests or a cloud-speech build pass different services. */
export function createBrowserServices(): Services {
  return {
    api: new HttpAssistantApi(import.meta.env.VITE_API_BASE_URL ?? ''),
    recognizer: new WebSpeechRecognizer(),
    synthesizer: new WebSpeechSynthesizer(),
  };
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
