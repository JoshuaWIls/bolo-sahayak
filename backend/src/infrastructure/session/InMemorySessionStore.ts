import type { SessionStore } from '../../domain/ports';
import type { Session } from '../../domain/session';

/**
 * Sessions live only in memory and expire after inactivity.
 * Nothing is written to disk — "End and erase" deletes immediately.
 */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, { session: Session; touchedAt: number }>();

  constructor(
    private readonly ttlMs = 30 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  get(id: string): Session | undefined {
    const entry = this.sessions.get(id);
    if (!entry) return undefined;
    if (this.now() - entry.touchedAt > this.ttlMs) {
      this.sessions.delete(id);
      return undefined;
    }
    return entry.session;
  }

  save(session: Session): void {
    this.sessions.set(session.id, { session, touchedAt: this.now() });
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }
}
