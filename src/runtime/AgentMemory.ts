import { AgentMemoryEntry } from '@/agents/AgentTypes';

const STORAGE_PREFIX = 'agentcorp_memory_';
const SHARED_MEMORY_KEY = 'agentcorp_shared_memory';

class AgentMemory {
  private cache: Map<string, AgentMemoryEntry[]> = new Map();
  private sharedCache: AgentMemoryEntry[] | null = null;

  private storageKey(agentId: string): string {
    return `${STORAGE_PREFIX}${agentId}`;
  }

  private loadFromStorage<T>(key: string): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage<T>(key: string, data: T[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(data.slice(-100)));
    } catch {
      // storage full — prune
      try {
        localStorage.setItem(key, JSON.stringify(data.slice(-50)));
      } catch { /* ignore */ }
    }
  }

  getAgentMemory(agentId: string): AgentMemoryEntry[] {
    if (!this.cache.has(agentId)) {
      this.cache.set(agentId, this.loadFromStorage(this.storageKey(agentId)));
    }
    return this.cache.get(agentId) || [];
  }

  addAgentMemory(agentId: string, entry: Omit<AgentMemoryEntry, 'id' | 'timestamp'>): void {
    const memory = this.getAgentMemory(agentId);
    const full: AgentMemoryEntry = {
      ...entry,
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    memory.push(full);
    this.cache.set(agentId, memory);
    this.saveToStorage(this.storageKey(agentId), memory);
  }

  searchAgentMemory(agentId: string, query: string): AgentMemoryEntry[] {
    const memory = this.getAgentMemory(agentId);
    const q = query.toLowerCase();
    return memory.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  getSharedMemory(): AgentMemoryEntry[] {
    if (!this.sharedCache) {
      this.sharedCache = this.loadFromStorage(SHARED_MEMORY_KEY);
    }
    return this.sharedCache || [];
  }

  addSharedMemory(entry: Omit<AgentMemoryEntry, 'id' | 'timestamp'>): void {
    const memory = this.getSharedMemory();
    const full: AgentMemoryEntry = {
      ...entry,
      id: `smem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    memory.push(full);
    this.sharedCache = memory;
    this.saveToStorage(SHARED_MEMORY_KEY, memory);
  }

  searchSharedMemory(query: string): AgentMemoryEntry[] {
    const memory = this.getSharedMemory();
    const q = query.toLowerCase();
    return memory.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  // Simple vector similarity via keyword overlap
  findRelevant(agentId: string | null, query: string, limit = 3): AgentMemoryEntry[] {
    const source = agentId
      ? this.searchAgentMemory(agentId, query)
      : this.searchSharedMemory(query);

    const qWords = query.toLowerCase().split(/\s+/);
    const scored = source.map((entry) => {
      const content = entry.content.toLowerCase();
      const score = qWords.filter((w) => content.includes(w)).length / qWords.length;
      return { entry, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  clearAgentMemory(agentId: string): void {
    this.cache.delete(agentId);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey(agentId));
    }
  }
}

export const agentMemory = new AgentMemory();
