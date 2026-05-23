import { MemoryVector } from '@/agents/AgentTypes';

const STORAGE_KEY = 'agentcorp_vectors';

export class VectorMemory {
  private vectors: MemoryVector[] = [];
  private initialized = false;

  constructor() {
    this.load();
  }

  async store(entry: MemoryVector): Promise<void> {
    this.vectors.push(entry);
    if (this.vectors.length > 500) {
      this.vectors = this.vectors.slice(-500);
    }
    this.save();
  }

  async storeBatch(entries: MemoryVector[]): Promise<void> {
    for (const entry of entries) {
      this.vectors.push(entry);
    }
    if (this.vectors.length > 500) {
      this.vectors = this.vectors.slice(-500);
    }
    this.save();
  }

  async search(query: string, limit: number = 5): Promise<MemoryVector[]> {
    const qWords = query.toLowerCase().split(/\s+/);

    const scored = this.vectors.map((v) => {
      const content = v.content.toLowerCase();
      const metaStr = Object.values(v.metadata).join(' ').toLowerCase();
      const text = `${content} ${metaStr}`;
      const matchCount = qWords.filter((w) => text.includes(w)).length;
      const score = matchCount / qWords.length;
      return { entry: v, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  async searchByMetadata(key: string, value: string): Promise<MemoryVector[]> {
    return this.vectors.filter((v) => v.metadata[key] === value);
  }

  async getRecent(limit: number = 10): Promise<MemoryVector[]> {
    return this.vectors.slice(-limit).reverse();
  }

  count(): number {
    return this.vectors.length;
  }

  clear(): void {
    this.vectors = [];
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.vectors));
    } catch {
      // localStorage may be full or unavailable
    }
  }

  private load(): void {
    if (this.initialized) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.vectors = JSON.parse(raw);
      }
    } catch {
      // localStorage unavailable
    }
    this.initialized = true;
  }
}
