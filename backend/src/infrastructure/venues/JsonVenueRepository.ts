import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { VenueRepository } from '../../domain/ports';
import type { Venue } from '../../domain/types';

const SAFE_CODE = /^[A-Z0-9-]{3,40}$/;

/** Loads venue configuration from `<dir>/<CODE>.json`. */
export class JsonVenueRepository implements VenueRepository {
  private readonly cache = new Map<string, Venue>();

  constructor(private readonly directory: string) {}

  async findByCode(code: string): Promise<Venue | null> {
    const normalized = code.toUpperCase();
    if (!SAFE_CODE.test(normalized)) return null; // also blocks path traversal

    const cached = this.cache.get(normalized);
    if (cached) return cached;

    try {
      const file = path.join(this.directory, `${normalized}.json`);
      const venue = JSON.parse(await readFile(file, 'utf8')) as Venue;
      this.cache.set(normalized, venue);
      return venue;
    } catch {
      return null;
    }
  }
}
