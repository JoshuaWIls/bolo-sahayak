import type { TurnResult, VenueInfo } from '../domain/types';
import type { AssistantApi } from '../ports';

/** A non-2xx response; `status` lets the UI tell "not found" from "network down". */
export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`Request failed (${status})`);
    this.name = 'HttpError';
  }
}

export class HttpAssistantApi implements AssistantApi {
  constructor(
    private readonly baseUrl = '',
    /** Claude replies can take several seconds on a slow mobile network. */
    private readonly timeoutMs = 25_000,
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

  async readDocument(input: Parameters<AssistantApi['readDocument']>[0]): Promise<TurnResult> {
    return this.request<TurnResult>(
      '/api/document',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
      45_000,
    );
  }

  async endSession(sessionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  }

  private async request<T>(path: string, init?: RequestInit, timeoutMs = this.timeoutMs): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new HttpError(res.status);
    return (await res.json()) as T;
  }
}
