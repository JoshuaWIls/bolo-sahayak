import type { SessionStore } from '../../domain/ports';
import type { Session } from '../../domain/session';

/**
 * Sessions live only in memory and expire after inactivity.
 * Nothing is written to disk — "End and erase" deletes immediately.
 * Expired sessions are swept out periodically so abandoned conversations
 * don't pile up in memory; a hard cap evicts the oldest if traffic spikes.
 */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, { session: Session; touchedAt: number }>();
  private lastSweep = 0;

  constructor(
    private readonly ttlMs = 30 * 60 * 1000,
    private readonly now: () => number = Date.now,
    private readonly maxSessions = 10_000,
    private readonly sweepEveryMs = 60 * 1000,
  ) {}

  get size(): number {
    return this.sessions.size;
  }

  get(id: string): Session | undefined {
    const entry = this.sessions.get(id);
    if (!entry) return undefined;
    if (this.isExpired(entry.touchedAt)) {
      this.sessions.delete(id);
      return undefined;
    }
    return entry.session;
  }

  save(session: Session): void {
    // Re-insert so Map order tracks recency (oldest first) for eviction.
    this.sessions.delete(session.id);
    this.sessions.set(session.id, { session, touchedAt: this.now() });
    this.sweepIfDue();
    while (this.sessions.size > this.maxSessions) {
      const oldest = this.sessions.keys().next().value;
      if (oldest === undefined) break;
      this.sessions.delete(oldest);
    }
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  private sweepIfDue(): void {
    const now = this.now();
    if (now - this.lastSweep < this.sweepEveryMs) return;
    this.lastSweep = now;
    for (const [id, entry] of this.sessions) {
      if (this.isExpired(entry.touchedAt)) this.sessions.delete(id);
    }
  }

  private isExpired(touchedAt: number): boolean {
    return this.now() - touchedAt > this.ttlMs;
  }
}
