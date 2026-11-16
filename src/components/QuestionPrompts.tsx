'use client';

import { useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { useQuestionStore, SKIPPED_ANSWER, type UserQuestion } from '@/engine/questions';
import { useGameStore } from '@/store/gameStore';
import RoleIcon from '@/components/RoleIcon';

function QuestionCard({ q }: { q: UserQuestion }) {
  const answer = useQuestionStore((s) => s.answer);
  const agent = useGameStore((s) => s.agents.find((a) => a.id === q.agentId));
  const addUserMessage = useGameStore((s) => s.addUserMessage);
  const [text, setText] = useState('');

  const send = (value: string) => {
    const v = value.trim();
    if (!v) return;
    // The reply belongs in the conversation, like anything else the user says.
    addUserMessage(v);
    answer(q.id, v);
  };

  return (
    <div className="rounded-2xl border border-sky-400/30 bg-sky-400/[0.07] p-3" data-testid="question-card">
      <div className="flex items-start gap-2">
        {agent
          ? <RoleIcon role={agent.role} size={16} className="mt-0.5 shrink-0" />
          : <MessageCircleQuestion className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-navy/45 uppercase tracking-wider">
            {agent ? `${agent.name} has a question` : 'Your agent has a question'}
          </p>
          <p className="text-sm text-navy/90 mt-0.5 whitespace-pre-wrap break-words">{q.question}</p>

          {q.options.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {q.options.map((o) => (
                <button
                  key={o}
                  onClick={() => send(o)}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-navy cursor-pointer transition-colors"
                >
                  {o}
                </button>
              ))}
            </div>
          )}

          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); send(text); setText(''); }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your answer…"
              aria-label="Answer the agent's question"
              className="flex-1 min-w-0 bg-black/20 border border-navy/10 rounded-xl px-3 py-1.5 text-xs text-navy placeholder:text-navy/30 focus:outline-none focus:border-white/25"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-navy cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => answer(q.id, SKIPPED_ANSWER)}
              className="px-2 py-1.5 rounded-xl text-xs font-semibold text-navy/50 hover:text-navy/80 cursor-pointer transition-colors"
              title="Let the agent decide and note what it assumed"
            >
              Skip
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Open questions from running agents, shown above the chat input next to approval prompts. */
export default function QuestionPrompts() {
  const pending = useQuestionStore((s) => s.pending);
  if (pending.length === 0) return null;
  return (
    <div className="shrink-0 px-3 sm:px-5 pt-2 space-y-2" data-testid="question-prompts">
      {pending.map((q) => <QuestionCard key={q.id} q={q} />)}
    </div>
  );
}
