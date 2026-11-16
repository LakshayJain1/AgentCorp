import { create } from 'zustand';

/**
 * Questions an agent asks the user mid-run (E3). The run sits in the "blocked"
 * state until the user answers, skips, or stops the run. Questions are not
 * persisted: if the app restarts while one is open, the run comes back as
 * "interrupted" and the agent simply asks again after Resume.
 */

export interface UserQuestion {
  id: string;
  taskId: string;
  agentId?: string;
  question: string;
  /** Optional quick-reply choices; the user can always type something else. */
  options: string[];
  createdAt: number;
}

interface Pending extends UserQuestion {
  resolve: (answer: string | null) => void;
}

interface QuestionState {
  pending: Pending[];
  ask: (q: Omit<UserQuestion, 'id' | 'createdAt'>, signal?: AbortSignal) => Promise<string | null>;
  answer: (id: string, text: string) => void;
  cancelForTask: (taskId: string) => void;
}

let seq = 0;

export const SKIPPED_ANSWER = '(The user chose not to answer. Use your best judgment, and say in your summary what you assumed.)';

export const useQuestionStore = create<QuestionState>((set, get) => ({
  pending: [],

  ask: (q, signal) =>
    new Promise<string | null>((resolve) => {
      const id = `q_${Date.now().toString(36)}_${++seq}`;
      const item: Pending = { ...q, id, createdAt: Date.now(), resolve };
      set((s) => ({ pending: [...s.pending, item] }));
      // Stopping the run must not leave an orphan question on screen.
      signal?.addEventListener('abort', () => {
        const still = get().pending.find((p) => p.id === id);
        if (!still) return;
        set((s) => ({ pending: s.pending.filter((p) => p.id !== id) }));
        resolve(null);
      }, { once: true });
    }),

  answer: (id, text) => {
    const item = get().pending.find((p) => p.id === id);
    if (!item) return;
    set((s) => ({ pending: s.pending.filter((p) => p.id !== id) }));
    item.resolve(text.trim() || SKIPPED_ANSWER);
  },

  cancelForTask: (taskId) => {
    const mine = get().pending.filter((p) => p.taskId === taskId);
    if (mine.length === 0) return;
    set((s) => ({ pending: s.pending.filter((p) => p.taskId !== taskId) }));
    for (const p of mine) p.resolve(null);
  },
}));

export function askUser(q: Omit<UserQuestion, 'id' | 'createdAt'>, signal?: AbortSignal): Promise<string | null> {
  return useQuestionStore.getState().ask(q, signal);
}
