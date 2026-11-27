import type { TurnResult, VenueInfo } from '../domain/types';
import type { AssistantApi } from '../ports';

export class HttpAssistantApi implements AssistantApi {
  constructor(
    private readonly baseUrl = '',
    private readonly timeoutMs = 8000,
  ) {}

  async getVenue(code: string): Promise<VenueInfo> {
    return this.request<VenueInfo>(`/api/venues/${encodeURIComponent(code)}`);
  }

  async sendTurn(input: Parameters<AssistantApi['sendTurn']>[0]): Promise<TurnResult> {
    return this.request<TurnResult>('/api/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async endSession(sessionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return (await res.json()) as T;
  }
}
