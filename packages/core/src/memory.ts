import { MemoryStore, MemoryRef } from './types';

export class InMemoryStore implements MemoryStore {
  private store: Map<string, unknown> = new Map();

  async get(id: string): Promise<unknown> {
    return this.store.get(id);
  }

  async set(id: string, data: unknown): Promise<void> {
    this.store.set(id, data);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async search(query: string, limit: number = 10): Promise<Array<{ id: string; data: unknown; score: number }>> {
    const results: Array<{ id: string; data: unknown; score: number }> = [];
    for (const [id, data] of this.store.entries()) {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      const score = str.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
      if (score > 0) {
        results.push({ id, data, score });
      }
      if (results.length >= limit) break;
    }
    return results;
  }
}

export function createMemoryRef(type: 'session' | 'project' | 'agent' | 'shared'): MemoryRef {
  return {
    id: crypto.randomUUID(),
    type,
  };
}
