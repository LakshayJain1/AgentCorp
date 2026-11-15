import { create } from 'zustand';

/**
 * In-app approval gate for actions that leave the sandbox (post to Slack,
 * create a Linear issue, …). Desktop shell commands are approved in a native
 * dialog by the main process instead, because a web page must never be able to
 * approve its own request.
 */

export type ApprovalDecision = 'allow_once' | 'allow_always' | 'deny';

export interface ApprovalRequest {
  id: string;
  taskId: string;
  agentId?: string;
  /** Stable key used for "always allow", e.g. `external:slack_post_message`. */
  key: string;
  title: string;
  detail: string;
  risk: 'external' | 'exec' | 'write';
  createdAt: number;
}

interface Pending extends ApprovalRequest {
  resolve: (d: ApprovalDecision) => void;
}

const STORAGE_KEY = 'agentcorp_always_allow';

function loadAlways(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* storage unavailable or corrupt */ }
  return new Set();
}

function saveAlways(keys: Set<string>): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys])); } catch { /* ignore */ }
}

interface ApprovalState {
  pending: Pending[];
  always: Set<string>;
  request: (req: Omit<ApprovalRequest, 'id' | 'createdAt'>, signal?: AbortSignal) => Promise<ApprovalDecision>;
  decide: (id: string, decision: ApprovalDecision) => void;
  revokeAlways: (key: string) => void;
}

let seq = 0;

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  pending: [],
  always: new Set<string>(),

  request: (req, signal) => {
    if (get().always.size === 0 && typeof window !== 'undefined') {
      const stored = loadAlways();
      if (stored.size > 0) set({ always: stored });
    }
    if (get().always.has(req.key)) return Promise.resolve('allow_once');

    return new Promise<ApprovalDecision>((resolve) => {
      const id = `appr_${Date.now().toString(36)}_${++seq}`;
      const pending: Pending = { ...req, id, createdAt: Date.now(), resolve };
      set((s) => ({ pending: [...s.pending, pending] }));
      // A cancelled run must not leave a dangling prompt.
      signal?.addEventListener('abort', () => get().decide(id, 'deny'), { once: true });
    });
  },

  decide: (id, decision) => {
    const item = get().pending.find((p) => p.id === id);
    if (!item) return;
    if (decision === 'allow_always') {
      const always = new Set(get().always);
      always.add(item.key);
      saveAlways(always);
      set({ always });
    }
    set((s) => ({ pending: s.pending.filter((p) => p.id !== id) }));
    item.resolve(decision);
  },

  revokeAlways: (key) => {
    const always = new Set(get().always);
    always.delete(key);
    saveAlways(always);
    set({ always });
  },
}));

export function requestApproval(
  req: Omit<ApprovalRequest, 'id' | 'createdAt'>,
  signal?: AbortSignal,
): Promise<ApprovalDecision> {
  return useApprovalStore.getState().request(req, signal);
}
