'use client';

import { useGameStore } from '@/store/gameStore';
import RoleIcon from '@/components/RoleIcon';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  coding: 'Working',
  debugging: 'Debugging',
  researching: 'Researching',
  reviewing: 'Reviewing',
  blocked: 'Blocked',
  communicating: 'Talking',
};

function statusTone(status: string | undefined, online: boolean): string {
  if (!online) return 'bg-navy/10 text-navy/40';
  if (status === 'blocked') return 'bg-rose-500/15 text-rose-400';
  if (!status || status === 'idle') return 'bg-white/5 text-navy/50';
  return 'bg-emerald-500/15 text-emerald-400';
}

/**
 * Shown instead of the 2D office when the renderer cannot start. The team keeps
 * working — this is only the visual layer — so the message says so, and the
 * roster below stays useful on its own.
 */
export default function OfficeFallback({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  const agents = useGameStore((s) => s.agents);

  return (
    <div
      data-testid="office-fallback"
      className="relative w-full h-full overflow-y-auto rounded-2xl border border-navy/10 bg-surface p-5 glass-scrollbar"
      style={{ minHeight: 480 }}
    >
      <div className="max-w-xl mx-auto">
        <h3 className="text-sm font-bold text-navy">The 2D office can&apos;t start on this device</h3>
        <p className="text-xs text-navy/55 mt-1.5 leading-relaxed">
          Hardware acceleration may be turned off in your browser. This only affects the animated view —
          your team is still working and you can keep using the chat.
        </p>
        {error && (
          <details className="mt-2">
            <summary className="text-[10px] text-navy/40 cursor-pointer">Technical details</summary>
            <pre className="mt-1 text-[10px] text-navy/45 whitespace-pre-wrap break-words max-h-28 overflow-auto">{error}</pre>
          </details>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-navy cursor-pointer transition-colors"
          >
            Try again
          </button>
        )}

        <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {agents.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 rounded-xl border border-navy/5 bg-black/10 px-3 py-2">
              <RoleIcon role={a.role} size={18} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-navy/90 truncate">{a.name}</div>
                <div className="text-[10px] text-navy/40 capitalize">{a.role}</div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusTone(a.workStatus, a.online)}`}>
                {a.online ? (STATUS_LABEL[a.workStatus ?? 'idle'] ?? a.workStatus) : 'Offline'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
