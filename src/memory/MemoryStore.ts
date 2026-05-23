import { AgentMemoryEntry } from '@/agents/AgentTypes';

interface PersistedMemory {
  agentId: string;
  entries: AgentMemoryEntry[];
}

export class MemoryStore {
  private perAgent: Map<string, AgentMemoryEntry[]> = new Map();
  private shared: AgentMemoryEntry[] = [];
  private dirtyAgents: Set<string> = new Set();
  private dirtyShared = false;
  private storageKey = 'agentcorp_memory_store';

  constructor() {
    this.load();
  }

  getAgentMemory(agentId: string): AgentMemoryEntry[] {
    return this.perAgent.get(agentId) || [];
  }

  addAgentMemory(agentId: string, entry: AgentMemoryEntry): void {
    const entries = this.perAgent.get(agentId) || [];
    entries.push(entry);
    this.perAgent.set(agentId, entries.slice(-100));
    this.dirtyAgents.add(agentId);
  }

  searchAgentMemory(agentId: string, query: string): AgentMemoryEntry[] {
    const entries = this.perAgent.get(agentId) || [];
    const q = query.toLowerCase();
    return entries.filter(
      (e) => e.content.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  getSharedMemory(): AgentMemoryEntry[] {
    return [...this.shared];
  }

  addSharedMemory(entry: AgentMemoryEntry): void {
    this.shared.push(entry);
    if (this.shared.length > 100) this.shared = this.shared.slice(-100);
    this.dirtyShared = true;
  }

  searchSharedMemory(query: string): AgentMemoryEntry[] {
    const q = query.toLowerCase();
    return this.shared.filter(
      (e) => e.content.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  findRelevant(agentId: string | null, query: string, limit: number = 3): AgentMemoryEntry[] {
    const pool = agentId ? this.getAgentMemory(agentId) : [];
    const all = [...pool, ...this.shared];
    const qWords = query.toLowerCase().split(/\s+/);

    const scored = all.map((entry) => {
      const content = entry.content.toLowerCase();
      const matchCount = qWords.filter((w) => content.includes(w)).length;
      const score = (matchCount / qWords.length) * entry.importance;
      return { entry, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  persist(): void {
    try {
      const data: PersistedMemory[] = [];
      for (const [agentId, entries] of this.perAgent) {
        data.push({ agentId, entries });
      }
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      localStorage.setItem(`${this.storageKey}_shared`, JSON.stringify(this.shared));
      this.dirtyAgents.clear();
      this.dirtyShared = false;
    } catch {
      // localStorage may be unavailable
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const data: PersistedMemory[] = JSON.parse(raw);
        for (const item of data) {
          this.perAgent.set(item.agentId, item.entries);
        }
      }
      const sharedRaw = localStorage.getItem(`${this.storageKey}_shared`);
      if (sharedRaw) {
        this.shared = JSON.parse(sharedRaw);
      }
    } catch {
      // localStorage may be unavailable
    }
  }

  clearAgentMemory(agentId: string): void {
    this.perAgent.delete(agentId);
    this.dirtyAgents.add(agentId);
  }

  clearAll(): void {
    this.perAgent.clear();
    this.shared = [];
    this.dirtyAgents.clear();
    this.dirtyShared = true;
  }
}
