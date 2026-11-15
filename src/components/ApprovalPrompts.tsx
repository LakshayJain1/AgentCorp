'use client';

import { ShieldQuestion } from 'lucide-react';
import { useApprovalStore } from '@/engine/approvals';

/** Pending "the agent wants to do X — allow?" cards, shown right above the chat input. */
export default function ApprovalPrompts() {
  const pending = useApprovalStore((s) => s.pending);
  const decide = useApprovalStore((s) => s.decide);
  if (pending.length === 0) return null;

  return (
    <div className="shrink-0 px-3 sm:px-5 pt-2 space-y-2" data-testid="approval-prompts">
      {pending.map((p) => (
        <div key={p.id} className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-3" data-testid="approval-card">
          <div className="flex items-start gap-2">
            <ShieldQuestion className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-navy/90">{p.title}</p>
              <pre className="mt-1 text-[10px] text-navy/55 whitespace-pre-wrap break-words max-h-28 overflow-auto font-mono">{p.detail}</pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => decide(p.id, 'allow_once')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-navy cursor-pointer transition-colors"
                >
                  Allow once
                </button>
                {p.risk === 'external' && (
                  <button
                    onClick={() => decide(p.id, 'allow_always')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-navy/70 cursor-pointer transition-colors"
                  >
                    Always allow this
                  </button>
                )}
                <button
                  onClick={() => decide(p.id, 'deny')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                >
                  Deny
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
